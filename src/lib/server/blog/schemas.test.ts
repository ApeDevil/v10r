/**
 * Upload-confirmation contract.
 *
 * The point of these is narrow but load-bearing: confirmation must not be able
 * to *declare* what landed in R2. The server reads size and content type back
 * from the object itself, so those fields have no place on the wire — and a
 * schema that merely stopped reading them, while still accepting them, would
 * leave the old lie one refactor away from being persisted again.
 */
import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';
import { ConfirmUploadSchema, RequestUploadSchema } from './schemas';

const KEY = 'blog/3f1a2b4c-5d6e-7f80-9012-3456789abcde.png';

describe('ConfirmUploadSchema', () => {
	it('accepts a confirmation that declares only what the server cannot verify', () => {
		const result = safeParse(ConfirmUploadSchema, {
			key: KEY,
			fileName: 'diagram.png',
			width: 800,
			height: 600,
			altText: 'A diagram',
		});
		expect(result.success).toBe(true);
	});

	it('does not carry a caller-declared fileSize or mimeType through to the output', () => {
		const result = safeParse(ConfirmUploadSchema, {
			key: KEY,
			fileName: 'diagram.png',
			fileSize: 1,
			mimeType: 'image/png',
		});
		expect(result.success).toBe(true);
		// The fields are stripped rather than rejected, so an older client keeps
		// working — but nothing downstream can read the values it sent.
		expect(result.output).not.toHaveProperty('fileSize');
		expect(result.output).not.toHaveProperty('mimeType');
	});

	it('still pins the key to the blog namespace', () => {
		for (const key of [
			'showcase/imagemeta/usr_a/img.webp',
			'avatars/usr_a.png',
			'blog/../secret.png',
			'blog/not-a-uuid.png',
		]) {
			expect(safeParse(ConfirmUploadSchema, { key, fileName: 'x.png' }).success).toBe(false);
		}
	});

	it('requires a key and a file name', () => {
		expect(safeParse(ConfirmUploadSchema, { fileName: 'x.png' }).success).toBe(false);
		expect(safeParse(ConfirmUploadSchema, { key: KEY }).success).toBe(false);
	});
});

describe('RequestUploadSchema', () => {
	it('still bounds the declared size at issuance', () => {
		// Issuance genuinely needs the caller's declared size — it is what picks
		// the tier limit before anything is signed. Confirmation is where the
		// claim stops being trusted.
		expect(safeParse(RequestUploadSchema, { fileName: 'a.png', mimeType: 'image/png', fileSize: 1 }).success).toBe(
			true,
		);
		expect(
			safeParse(RequestUploadSchema, { fileName: 'a.png', mimeType: 'image/png', fileSize: 50_000_001 }).success,
		).toBe(false);
		expect(safeParse(RequestUploadSchema, { fileName: 'a.png', mimeType: 'not-a-mime', fileSize: 1 }).success).toBe(
			false,
		);
	});
});
