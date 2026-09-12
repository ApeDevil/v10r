import { describe, expect, it } from 'vitest';
import { decryptAesGcm, EncryptionError, encryptAesGcm, parseEncryptionKey } from './aes-gcm';

const KEY = '3f9c2a1b7e4d5c6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f';
const OTHER_KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

/**
 * Produced by the pre-extraction `notifications/crypto.ts` (`encrypt()` under KEY) on
 * 2026-09-11. Discord tokens already in the table are in this exact format; this vector
 * is what proves the extraction did not change it.
 */
const LEGACY_VECTOR = 'MR3AG3VIaj1e8QIl:nYhmE5k7i8NzImg1cQkJmmCRGfLtuSjwdBWpfMYa37Wk2AsIOabzKyfeeiw=';
const LEGACY_PLAINTEXT = 'sk-test-plaintext-for-vector';

describe('aes-gcm', () => {
	it('decrypts an envelope written by the pre-extraction notifications module', async () => {
		await expect(decryptAesGcm(LEGACY_VECTOR, KEY)).resolves.toBe(LEGACY_PLAINTEXT);
	});

	it('round-trips and keeps the base64(nonce):base64(ciphertext) format with a 12-byte nonce', async () => {
		const stored = await encryptAesGcm('gsk_example_key', KEY);
		expect(stored).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
		const [nonce] = stored.split(':');
		expect(atob(nonce as string)).toHaveLength(12);
		await expect(decryptAesGcm(stored, KEY)).resolves.toBe('gsk_example_key');
	});

	it('never yields plaintext under the wrong key', async () => {
		const stored = await encryptAesGcm('secret', KEY);
		await expect(decryptAesGcm(stored, OTHER_KEY)).rejects.toMatchObject({ kind: 'decrypt_failed' });
	});

	it('refuses a tampered envelope', async () => {
		const stored = await encryptAesGcm('secret', KEY);
		const [nonce, ct] = stored.split(':') as [string, string];
		const flipped = `${nonce}:${ct.slice(0, -4)}${ct.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`;
		await expect(decryptAesGcm(flipped, KEY)).rejects.toBeInstanceOf(EncryptionError);
	});

	it('reports malformed storage without touching the key', async () => {
		await expect(decryptAesGcm('not-an-envelope', KEY)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
		await expect(decryptAesGcm('YWJj:!!!', KEY)).rejects.toMatchObject({ kind: 'malformed_ciphertext' });
	});

	it('rejects short, non-hex and placeholder keys', () => {
		expect(() => parseEncryptionKey(undefined)).toThrow(EncryptionError);
		expect(() => parseEncryptionKey('abc')).toThrow(/64-character/);
		expect(() => parseEncryptionKey('z'.repeat(64))).toThrow(/hex/);
		expect(() => parseEncryptionKey('0'.repeat(64))).toThrow(/placeholder/);
		expect(() => parseEncryptionKey(`deadbeef${'1'.repeat(56)}`)).toThrow(/placeholder/);
		expect(parseEncryptionKey(KEY)).toHaveLength(32);
	});
});
