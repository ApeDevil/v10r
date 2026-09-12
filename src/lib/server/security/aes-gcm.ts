/**
 * Authenticated encryption for stored credentials — AES-256-GCM via Web Crypto.
 *
 * Storage format: `base64(nonce):base64(ciphertext‖tag)` with a 12-byte random nonce.
 * Two tables hold envelopes in this format — Discord OAuth tokens and AI provider API
 * keys — so the format is a stored contract: changing it means re-encrypting both.
 *
 * The key is an argument, never read here. `encryption-key.ts` is the one module that
 * takes it from the environment; the bare-Bun ingest scripts take it from `process.env`
 * and reach this file by relative path, which is why it imports nothing that resolves
 * through a Vite alias.
 */
import { ServerError } from '../errors';

export type EncryptionErrorKind = 'invalid_key' | 'malformed_ciphertext' | 'decrypt_failed';

export class EncryptionError extends ServerError {
	constructor(kind: EncryptionErrorKind, message: string) {
		super(kind, message);
		this.name = 'EncryptionError';
	}

	toStatus(): number {
		return 500;
	}
}

/** Obvious non-secrets that must never be used as a real key. */
const DUMMY_KEY_PATTERNS = [/^0+$/, /^(?:de)?adbeef/i, /^64-char/i, /^changeme/i, /^replace/i];

const NONCE_BYTES = 12;

/**
 * Validate a 64-hex-char (32-byte) key and return its bytes. Rejects placeholders
 * unconditionally: a placeholder key "works" while providing no confidentiality, and
 * the cost of finding that out at decrypt time is every credential encrypted under it.
 */
export function parseEncryptionKey(keyHex: string | null | undefined): Uint8Array<ArrayBuffer> {
	if (!keyHex || keyHex.length !== 64) {
		throw new EncryptionError('invalid_key', 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
	}
	if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
		throw new EncryptionError('invalid_key', 'ENCRYPTION_KEY must be hex. Generate with: openssl rand -hex 32');
	}
	if (DUMMY_KEY_PATTERNS.some((rx) => rx.test(keyHex))) {
		throw new EncryptionError(
			'invalid_key',
			'ENCRYPTION_KEY looks like a placeholder. Generate with: openssl rand -hex 32',
		);
	}
	const keyBytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		keyBytes[i] = Number.parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
	}
	return keyBytes;
}

function importKey(keyHex: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', parseEncryptionKey(keyHex), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Seal a plaintext string under `keyHex`. Returns `nonce:ciphertext` in base64. */
export async function encryptAesGcm(plaintext: string, keyHex: string): Promise<string> {
	const key = await importKey(keyHex);
	const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce },
		key,
		new TextEncoder().encode(plaintext),
	);
	return `${toBase64(nonce)}:${toBase64(new Uint8Array(ciphertext))}`;
}

/** Open a stored `nonce:ciphertext` envelope under `keyHex`. */
export async function decryptAesGcm(stored: string, keyHex: string): Promise<string> {
	const key = await importKey(keyHex);
	const [nonceB64, ctB64] = stored.split(':');
	if (!nonceB64 || !ctB64) {
		throw new EncryptionError('malformed_ciphertext', 'Stored ciphertext is not in nonce:ciphertext form.');
	}

	let nonce: Uint8Array<ArrayBuffer>;
	let ciphertext: Uint8Array<ArrayBuffer>;
	try {
		nonce = fromBase64(nonceB64);
		ciphertext = fromBase64(ctB64);
	} catch {
		throw new EncryptionError('malformed_ciphertext', 'Stored ciphertext is not valid base64.');
	}
	if (nonce.length !== NONCE_BYTES) {
		throw new EncryptionError('malformed_ciphertext', 'Stored ciphertext carries a nonce of the wrong length.');
	}

	try {
		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);
		return new TextDecoder().decode(plaintext);
	} catch {
		// Web Crypto reports a wrong key and a tampered envelope identically (OperationError),
		// which is the property we want: neither case yields a byte of plaintext.
		throw new EncryptionError(
			'decrypt_failed',
			'Stored ciphertext could not be decrypted with the current ENCRYPTION_KEY.',
		);
	}
}
