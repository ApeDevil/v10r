/**
 * Namespace containment for the PUBLIC storage showcase.
 *
 * These read paths are reachable by anonymous visitors through form actions on
 * `/showcases/db/storage/*`, and they take the object key straight from the
 * request. One R2 bucket holds the showcase seed data, blog assets, avatars and
 * per-user image uploads — so an unguarded key here is a read primitive over all
 * of it, and the object listing is the oracle that makes the keys guessable.
 *
 * The assertions that matter are the `s3.send` ones: they prove the guard runs
 * BEFORE the client is touched. A guard placed after `requireS3()` still throws
 * in production but is unreachable wherever R2 is unconfigured, which would make
 * a config value decide whether an authorization check happens.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Both mocks are declared with an explicit signature rather than letting `vi.fn`
 * infer one from the implementation. Inference would type `mock.calls` as an
 * empty tuple, and the assertions below read the arguments — the Range header
 * handed to R2, the TTL handed to the signer — because those are the values
 * that actually bind. Asserting on return values instead would pass against a
 * fix that clamps only what it reports.
 */
type S3Send = (command: { input: Record<string, unknown> }) => Promise<Record<string, unknown>>;
type Presigner = (client: unknown, command: unknown, options: { expiresIn: number }) => Promise<string>;

const send = vi.fn<S3Send>(async () => ({ ContentLength: 3, ContentType: 'text/plain' }));
const getSignedUrl = vi.fn<Presigner>(async () => 'https://signed.example/object');

vi.mock('$lib/server/store', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/store')>()),
	s3: { send },
	BUCKET: 'test-bucket',
}));
// The presigner reads `client.config` off a real S3Client, so a stub client is
// not enough on its own — it has to be mocked alongside.
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

const { generateDownloadUrl, getObjectDetail, getObjectRange } = await import('./queries');
const { PRESIGNED_URL_EXPIRY } = await import('$lib/server/store/config');

/** Every namespace an anonymous caller must not be able to reach. */
const FORBIDDEN_KEYS = [
	'blog/3f1a2b4c-5d6e-7f80-9012-3456789abcde.png', // another author's asset, draft or not
	'avatars/usr_abc123.webp', // derived from a user id, so trivially guessable
	'showcase/imagemeta/usr_abc123/img_1.webp', // private upload, key embeds the user
	'showcase/imagekit/usr_abc123/img_1.webp',
	'', // empty key must not fall through to a bucket-root operation
];

describe('showcase object reads are confined to the public namespace', () => {
	beforeEach(() => {
		send.mockClear();
		getSignedUrl.mockClear();
	});

	for (const key of FORBIDDEN_KEYS) {
		const label = key || '(empty key)';

		it(`getObjectDetail refuses ${label}`, async () => {
			await expect(getObjectDetail(key)).rejects.toMatchObject({ kind: 'forbidden' });
			expect(send).not.toHaveBeenCalled();
		});

		it(`generateDownloadUrl refuses ${label}`, async () => {
			await expect(generateDownloadUrl(key, 300)).rejects.toMatchObject({ kind: 'forbidden' });
			expect(getSignedUrl).not.toHaveBeenCalled();
			expect(send).not.toHaveBeenCalled();
		});

		it(`getObjectRange refuses ${label}`, async () => {
			await expect(getObjectRange(key, 0, 63)).rejects.toMatchObject({ kind: 'forbidden' });
			expect(send).not.toHaveBeenCalled();
		});
	}

	it('still serves a genuine showcase key', async () => {
		await getObjectDetail('showcase/text/hello.txt');
		expect(send).toHaveBeenCalledTimes(1);
	});
});

describe('presigned download TTL is bounded', () => {
	beforeEach(() => {
		getSignedUrl.mockClear();
	});

	/** The TTL handed to the signer — the only value that actually binds. */
	const signedTtl = () => getSignedUrl.mock.calls[0]?.[2]?.expiresIn;

	it('caps a week-long request at the project expiry', async () => {
		const result = await generateDownloadUrl('showcase/text/hello.txt', 604_800);
		expect(signedTtl()).toBe(PRESIGNED_URL_EXPIRY);
		// The reported value must match what was signed, not what was asked for.
		expect(result.expiresIn).toBe(PRESIGNED_URL_EXPIRY);
	});

	it('floors a negative, zero, or unparseable request', async () => {
		for (const bad of [-1, 0, Number.NaN]) {
			getSignedUrl.mockClear();
			await generateDownloadUrl('showcase/text/hello.txt', bad);
			expect(signedTtl()).toBe(PRESIGNED_URL_EXPIRY);
		}
	});

	it('honours a reasonable request unchanged', async () => {
		await generateDownloadUrl('showcase/text/hello.txt', 120);
		expect(signedTtl()).toBe(120);
	});
});

describe('range reads stay a bounded window', () => {
	beforeEach(() => {
		send.mockClear();
	});

	/** The Range header actually sent to R2. */
	const sentRange = () => send.mock.calls[0]?.[0]?.input?.Range;

	it('truncates an oversized window instead of streaming the object', async () => {
		send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array(4) } });
		await getObjectRange('showcase/binary/blob.bin', 0, 10_000_000);
		expect(sentRange()).toBe('bytes=0-1023');
	});

	it('clamps a negative start to zero', async () => {
		send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array(4) } });
		await getObjectRange('showcase/binary/blob.bin', -500, 63);
		expect(sentRange()).toBe('bytes=0-63');
	});

	it('rejects an inverted range rather than sending it', async () => {
		await expect(getObjectRange('showcase/binary/blob.bin', 500, 10)).rejects.toMatchObject({ kind: 'forbidden' });
		expect(send).not.toHaveBeenCalled();
	});
});
