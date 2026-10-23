import { describe, expect, it } from 'vitest';
import {
	decryptAesGcm,
	EncryptionError,
	encryptAesGcm,
	keyIdOf,
	openEnvelope,
	openSecret,
	parseEncryptionKey,
	parseKeyRing,
	resealEnvelope,
	tryParseKeyRing,
} from './aes-gcm';
import { resealEnvelopes } from './envelope-reseal';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const OTHER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const THIRD_KEY = '9e8d7c6b5a49382716051f2e3d4c5b6a79881726354f4e3d2c1b0a9f8e7d6c5b';

const RING = parseKeyRing(KEY);
const OTHER_RING = parseKeyRing(OTHER_KEY);
/** After a rotation: OTHER_KEY is current, KEY still opens what it sealed. */
const ROTATED = parseKeyRing(OTHER_KEY, KEY);

/**
 * Produced by the pre-extraction `notifications/crypto.ts` (`encrypt()` under KEY) on
 * 2026-09-11, before envelopes named their key. This vector is what proves the ring still
 * opens every envelope written before it.
 */
const LEGACY_VECTOR = 'MR3AG3VIaj1e8QIl:nYhmE5k7i8NzImg1cQkJmmCRGfLtuSjwdBWpfMYa37Wk2AsIOabzKyfeeiw=';
const LEGACY_PLAINTEXT = 'sk-test-plaintext-for-vector';

describe('aes-gcm', () => {
	it('opens a pre-ring envelope with any key of the ring, and calls it stale', async () => {
		await expect(decryptAesGcm(LEGACY_VECTOR, RING)).resolves.toBe(LEGACY_PLAINTEXT);
		await expect(openEnvelope(LEGACY_VECTOR, ROTATED)).resolves.toEqual({ plaintext: LEGACY_PLAINTEXT, stale: true });
		await expect(openEnvelope(LEGACY_VECTOR, RING)).resolves.toEqual({ plaintext: LEGACY_PLAINTEXT, stale: true });
	});

	it('seals as v2:<kid>:nonce:ciphertext with a 12-byte nonce and the current key id', async () => {
		const stored = await encryptAesGcm('gsk_example_key', RING);
		expect(stored).toMatch(/^v2:[0-9a-f]{8}:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
		const [, kid, nonce] = stored.split(':');
		expect(kid).toBe(await keyIdOf(KEY));
		expect(atob(nonce as string)).toHaveLength(12);
		await expect(openEnvelope(stored, RING)).resolves.toEqual({ plaintext: 'gsk_example_key', stale: false });
	});

	it('derives a stable key id that differs per key', async () => {
		expect(await keyIdOf(KEY)).toBe(await keyIdOf(KEY));
		expect(await keyIdOf(KEY)).not.toBe(await keyIdOf(OTHER_KEY));
	});

	it('opens an envelope by the key it names after a rotation, and marks it stale', async () => {
		const sealedBefore = await encryptAesGcm('secret', RING);
		await expect(openEnvelope(sealedBefore, ROTATED)).resolves.toEqual({ plaintext: 'secret', stale: true });
		const sealedAfter = await encryptAesGcm('secret', ROTATED);
		await expect(openEnvelope(sealedAfter, ROTATED)).resolves.toEqual({ plaintext: 'secret', stale: false });
	});

	it('never yields plaintext when the named key left the ring', async () => {
		const stored = await encryptAesGcm('secret', RING);
		await expect(decryptAesGcm(stored, OTHER_RING)).rejects.toMatchObject({ kind: 'decrypt_failed' });
		await expect(decryptAesGcm(stored, OTHER_RING)).rejects.toThrow(/not in this deployment's key ring/);
	});

	it('refuses a tampered envelope', async () => {
		const stored = await encryptAesGcm('secret', RING);
		const [v, kid, nonce, ct] = stored.split(':') as [string, string, string, string];
		const flipped = `${v}:${kid}:${nonce}:${ct.slice(0, -4)}${ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
		await expect(decryptAesGcm(flipped, RING)).rejects.toBeInstanceOf(EncryptionError);
	});

	it('reports malformed storage without touching the key', async () => {
		await expect(decryptAesGcm('not-an-envelope', RING)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
		await expect(decryptAesGcm('YWJj:!!!', RING)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
		await expect(decryptAesGcm('v2:nothex!:YWJj:YWJj', RING)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
		await expect(decryptAesGcm('v3:00000000:YWJj:YWJj', RING)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
	});

	it('rejects short, non-hex and placeholder keys', () => {
		expect(() => parseEncryptionKey(undefined)).toThrow(EncryptionError);
		expect(() => parseEncryptionKey('abc')).toThrow(/64-character/);
		expect(() => parseEncryptionKey('z'.repeat(64))).toThrow(/hex/);
		expect(() => parseEncryptionKey('0'.repeat(64))).toThrow(/placeholder/);
		expect(() => parseEncryptionKey(`deadbeef${'1'.repeat(56)}`)).toThrow(/placeholder/);
		expect(parseEncryptionKey(KEY)).toHaveLength(32);
	});

	it('builds a ring from the current key and comma-separated previous keys', () => {
		expect(parseKeyRing(KEY)).toEqual({ current: KEY, previous: [] });
		expect(parseKeyRing(KEY, ` ${OTHER_KEY} , ${THIRD_KEY},`)).toEqual({
			current: KEY,
			previous: [OTHER_KEY, THIRD_KEY],
		});
		expect(() => parseKeyRing(KEY, '0'.repeat(64))).toThrow(/placeholder/);
		expect(() => parseKeyRing(KEY, KEY.toUpperCase())).toThrow(/repeats a key/);
		expect(() => parseKeyRing(undefined, OTHER_KEY)).toThrow(EncryptionError);
		expect(tryParseKeyRing(undefined)).toBeNull();
		expect(tryParseKeyRing(KEY, 'short')).toBeNull();
	});

	it('openSecret answers none / ready / undecryptable instead of throwing', async () => {
		const stored = await encryptAesGcm('tvly-example', RING);
		await expect(openSecret(null, RING)).resolves.toEqual({ plaintext: null, status: 'none', stale: false });
		await expect(openSecret(stored, RING)).resolves.toEqual({
			plaintext: 'tvly-example',
			status: 'ready',
			stale: false,
		});
		await expect(openSecret(stored, ROTATED)).resolves.toEqual({
			plaintext: 'tvly-example',
			status: 'ready',
			stale: true,
		});
		await expect(openSecret(stored, OTHER_RING)).resolves.toEqual({
			plaintext: null,
			status: 'undecryptable',
			stale: false,
		});
		await expect(openSecret(stored, null)).resolves.toEqual({ plaintext: null, status: 'undecryptable', stale: false });
		await expect(openSecret('not-an-envelope', RING)).resolves.toEqual({
			plaintext: null,
			status: 'undecryptable',
			stale: false,
		});
	});
});

describe('re-seal', () => {
	it('re-seals only stale envelopes, onto the current key', async () => {
		const fresh = await encryptAesGcm('a', ROTATED);
		await expect(resealEnvelope(fresh, ROTATED)).resolves.toBeNull();

		const old = await encryptAesGcm('b', RING);
		const moved = await resealEnvelope(old, ROTATED);
		expect(moved?.split(':')[1]).toBe(await keyIdOf(OTHER_KEY));
		await expect(openEnvelope(moved as string, OTHER_RING)).resolves.toEqual({ plaintext: 'b', stale: false });

		const fromLegacy = await resealEnvelope(LEGACY_VECTOR, ROTATED);
		await expect(decryptAesGcm(fromLegacy as string, OTHER_RING)).resolves.toBe(LEGACY_PLAINTEXT);
	});

	it('swaps stale rows, skips current ones, counts unreadable ones and honours a lost race', async () => {
		const rows = [
			{ key: 'stale', envelope: await encryptAesGcm('s', RING) },
			{ key: 'current', envelope: await encryptAesGcm('c', ROTATED) },
			{ key: 'orphan', envelope: await encryptAesGcm('o', parseKeyRing(THIRD_KEY)) },
			{ key: 'raced', envelope: LEGACY_VECTOR },
		];
		const swaps: string[] = [];
		const outcome = await resealEnvelopes(rows, ROTATED, async (key, from, to) => {
			expect(from).toBe(rows.find((r) => r.key === key)?.envelope);
			await expect(decryptAesGcm(to, OTHER_RING)).resolves.toBeTypeOf('string');
			swaps.push(key);
			return key !== 'raced';
		});
		expect(swaps).toEqual(['stale', 'raced']);
		expect(outcome).toEqual({ resealed: 1, unreadable: 1 });
	});
});
