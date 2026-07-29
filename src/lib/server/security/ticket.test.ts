import { beforeEach, describe, expect, it } from 'vitest';
import { deriveSubkey, resetSubkeyCache, SUBKEY_PURPOSES } from './subkey';
import { signTicket, verifyTicket } from './ticket';

const PURPOSE = SUBKEY_PURPOSES.blogUploadTicket;
const OTHER = SUBKEY_PURPOSES.analyticsVisitor;

const FUTURE = 4_000_000_000_000;
const PAST = 1_000;

describe('deriveSubkey', () => {
	beforeEach(() => {
		resetSubkeyCache();
		process.env.ANALYTICS_VISITOR_SALT = undefined as unknown as string;
		delete process.env.ANALYTICS_VISITOR_SALT;
		delete process.env.BLOG_UPLOAD_TICKET_SECRET;
	});

	it('gives each purpose an independent key', () => {
		expect(deriveSubkey(PURPOSE)).not.toBe(deriveSubkey(OTHER));
	});

	it('is deterministic for a purpose', () => {
		const first = deriveSubkey(PURPOSE);
		resetSubkeyCache();
		expect(deriveSubkey(PURPOSE)).toBe(first);
	});

	it('never returns the root secret itself', () => {
		expect(deriveSubkey(PURPOSE)).not.toBe(process.env.BETTER_AUTH_SECRET);
	});

	it('prefers an explicit override when one is set', () => {
		const derived = deriveSubkey(OTHER);
		resetSubkeyCache();
		process.env.ANALYTICS_VISITOR_SALT = 'rotated-salt-value';
		expect(deriveSubkey(OTHER)).toBe('rotated-salt-value');
		expect(deriveSubkey(OTHER)).not.toBe(derived);
		delete process.env.ANALYTICS_VISITOR_SALT;
		resetSubkeyCache();
	});

	it('throws rather than degrading when no key material exists at all', () => {
		const root = process.env.BETTER_AUTH_SECRET;
		delete process.env.BETTER_AUTH_SECRET;
		resetSubkeyCache();
		expect(() => deriveSubkey(PURPOSE)).toThrow(/BETTER_AUTH_SECRET/);
		process.env.BETTER_AUTH_SECRET = root;
		resetSubkeyCache();
	});
});

describe('signTicket / verifyTicket', () => {
	beforeEach(() => {
		resetSubkeyCache();
		delete process.env.BLOG_UPLOAD_TICKET_SECRET;
	});

	it('round-trips fields and expiry', () => {
		const raw = signTicket(PURPOSE, { key: 'blog/abc.png', userId: 'u1', maxBytes: 10 }, FUTURE);
		const check = verifyTicket(PURPOSE, raw);
		expect(check).toEqual({ ok: true, fields: { key: 'blog/abc.png', userId: 'u1', maxBytes: 10 }, expiresAt: FUTURE });
	});

	it('rejects a ticket issued for a different purpose', () => {
		const raw = signTicket(OTHER, { key: 'x' }, FUTURE);
		// Fails on the signature, not the purpose field: each purpose derives its
		// own key, so cross-purpose replay never reaches the payload check.
		expect(verifyTicket(PURPOSE, raw)).toEqual({ ok: false, reason: 'bad_signature' });
	});

	it('rejects an expired ticket', () => {
		const raw = signTicket(PURPOSE, { key: 'x' }, PAST);
		expect(verifyTicket(PURPOSE, raw)).toEqual({ ok: false, reason: 'expired' });
	});

	it('treats expiry as injectable so it is testable without the clock', () => {
		const raw = signTicket(PURPOSE, { key: 'x' }, 5_000);
		expect(verifyTicket(PURPOSE, raw, 4_999).ok).toBe(true);
		expect(verifyTicket(PURPOSE, raw, 5_000)).toEqual({ ok: false, reason: 'expired' });
	});

	it('rejects a tampered payload', () => {
		const raw = signTicket(PURPOSE, { key: 'blog/mine.png', userId: 'victim' }, FUTURE);
		const [payload, sig] = raw.split('.');
		const forged = Buffer.from(
			JSON.stringify({ p: PURPOSE, e: FUTURE, f: { key: 'blog/mine.png', userId: 'attacker' } }),
			'utf8',
		).toString('base64url');
		expect(forged).not.toBe(payload);
		expect(verifyTicket(PURPOSE, `${forged}.${sig}`)).toEqual({ ok: false, reason: 'bad_signature' });
	});

	it('rejects a tampered expiry — a client cannot extend its own ticket', () => {
		const raw = signTicket(PURPOSE, { key: 'x' }, PAST);
		const [, sig] = raw.split('.');
		const extended = Buffer.from(JSON.stringify({ p: PURPOSE, e: FUTURE, f: { key: 'x' } }), 'utf8').toString(
			'base64url',
		);
		expect(verifyTicket(PURPOSE, `${extended}.${sig}`)).toEqual({ ok: false, reason: 'bad_signature' });
	});

	it.each([
		['empty', ''],
		['no separator', 'abcdef'],
		['three parts', 'a.b.c'],
		['empty payload', '.aaaa'],
		['empty signature', 'aaaa.'],
		['short signature', `${Buffer.from('{}').toString('base64url')}.QUJD`],
	])('rejects a malformed ticket (%s)', (_label, raw) => {
		expect(verifyTicket(PURPOSE, raw)).toEqual({ ok: false, reason: 'malformed' });
	});

	it('survives field values containing the separator', () => {
		// The reason this module does not reuse pairing/cookie.ts: that format
		// splits on '.' across the payload itself, so a dotted value breaks it.
		const fields = { key: 'blog/a.b.c.png', fileName: 'my.file.name.png' };
		const check = verifyTicket(PURPOSE, signTicket(PURPOSE, fields, FUTURE));
		expect(check).toMatchObject({ ok: true, fields });
	});

	it('produces a signature that is not a substring of the payload', () => {
		const raw = signTicket(PURPOSE, { key: 'x' }, FUTURE);
		const [payload, sig] = raw.split('.');
		expect(sig.length).toBeGreaterThan(0);
		expect(payload).not.toContain(sig);
	});

	it('does not verify once the signing key is rotated', () => {
		const raw = signTicket(PURPOSE, { key: 'x' }, FUTURE);
		expect(verifyTicket(PURPOSE, raw).ok).toBe(true);
		process.env.BLOG_UPLOAD_TICKET_SECRET = 'a-freshly-rotated-upload-secret';
		resetSubkeyCache();
		expect(verifyTicket(PURPOSE, raw)).toEqual({ ok: false, reason: 'bad_signature' });
		delete process.env.BLOG_UPLOAD_TICKET_SECRET;
		resetSubkeyCache();
	});
});
