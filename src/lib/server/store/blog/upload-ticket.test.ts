/**
 * Upload issuance binding.
 *
 * Tests call `verifyUploadTicket` directly rather than driving the route. A
 * route-level check would satisfy an API test while leaving the domain function
 * unbound, and the domain function is what any second caller would reach.
 *
 * What this closes: confirmation used to check only the blog-author grant, so
 * any author could confirm any well-formed `blog/<uuid>.<ext>` key — including
 * one another author had uploaded but not yet confirmed. `storage_key` carries a
 * global unique index and first write wins, so the theft was permanent and the
 * rightful uploader's own confirm came back as a 409.
 */
import { describe, expect, it } from 'vitest';
import { SUBKEY_PURPOSES } from '$lib/server/security/subkey';
import { signTicket } from '$lib/server/security/ticket';
import { StoreError } from '../errors';
import { type UploadTicketClaims, verifyUploadTicket } from './mutations';

const KEY = 'blog/3f1a2b4c-5d6e-7f80-9012-3456789abcde.png';
const OWNER = 'usr_owner';
const OTHER = 'usr_other';

function issue(overrides: Partial<UploadTicketClaims> = {}, expiresAt = Date.now() + 60_000): string {
	return signTicket(
		SUBKEY_PURPOSES.blogUploadTicket,
		{
			key: KEY,
			userId: OWNER,
			fileName: 'diagram.png',
			mimeType: 'image/png',
			maxBytes: 10 * 1024 * 1024,
			...overrides,
		},
		expiresAt,
	);
}

describe('verifyUploadTicket', () => {
	it('returns the claims fixed at issuance', () => {
		const claims = verifyUploadTicket(issue(), KEY, OWNER);
		expect(claims).toMatchObject({ key: KEY, userId: OWNER, fileName: 'diagram.png', mimeType: 'image/png' });
	});

	it('refuses a ticket presented by a different user — the key-theft case', () => {
		expect(() => verifyUploadTicket(issue(), KEY, OTHER)).toThrow(StoreError);
	});

	it('refuses a ticket presented for a different key', () => {
		const otherKey = 'blog/11111111-2222-3333-4444-555555555555.png';
		expect(() => verifyUploadTicket(issue(), otherKey, OWNER)).toThrow(/not issued for this object/);
	});

	it('refuses an expired ticket with a message a client can act on', () => {
		expect(() => verifyUploadTicket(issue({}, Date.now() - 1), KEY, OWNER)).toThrow(/expired/i);
	});

	it('refuses a forged ticket', () => {
		expect(() => verifyUploadTicket('not.aticket', KEY, OWNER)).toThrow(StoreError);
	});

	it('refuses a ticket signed for a different purpose', () => {
		// Each purpose derives its own key, so a ticket minted elsewhere in the app
		// cannot be replayed here even if its field names happen to line up.
		const foreign = signTicket(
			SUBKEY_PURPOSES.analyticsVisitor,
			{ key: KEY, userId: OWNER, fileName: 'x.png', mimeType: 'image/png', maxBytes: 1 },
			Date.now() + 60_000,
		);
		expect(() => verifyUploadTicket(foreign, KEY, OWNER)).toThrow(StoreError);
	});

	it('carries the size limit that applied at issuance, not a re-derived one', () => {
		// A presigned PUT cannot enforce Content-Length at all, so confirmation is
		// the only place the size can be checked — and which limit applies depends
		// on the MIME type chosen at issuance. Re-deriving it at confirm from the
		// HeadObject content type would let a caller request a model/ upload,
		// store 50 MB, and have the image limit applied to something that is not
		// an image.
		const model = verifyUploadTicket(issue({ mimeType: 'model/gltf-binary', maxBytes: 50 * 1024 * 1024 }), KEY, OWNER);
		expect(model.maxBytes).toBe(50 * 1024 * 1024);
		expect(verifyUploadTicket(issue(), KEY, OWNER).maxBytes).toBe(10 * 1024 * 1024);
	});

	it('cannot have its bound user swapped without breaking the signature', () => {
		const ticket = issue();
		const [payload, signature] = ticket.split('.');
		const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		decoded.f.userId = OTHER;
		const forged = `${Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url')}.${signature}`;
		expect(() => verifyUploadTicket(forged, KEY, OTHER)).toThrow(StoreError);
	});
});
