/**
 * Token encryption — AES-256-GCM via Web Crypto API.
 * Storage format: base64(nonce):base64(ciphertext)
 */
import { env } from '$env/dynamic/private';

function getKey(): Promise<CryptoKey> {
	const keyHex = env.ENCRYPTION_KEY;
	if (!keyHex || keyHex.length !== 64) {
		throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
	}

	const keyBytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		keyBytes[i] = Number.parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
	}

	return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Encrypt a plaintext string. Returns nonce:ciphertext in base64. */
export async function encrypt(plaintext: string): Promise<string> {
	const key = await getKey();
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce },
		key,
		encoded,
	);

	const nonceB64 = btoa(String.fromCharCode(...nonce));
	const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

	return `${nonceB64}:${ctB64}`;
}

/** Decrypt a stored nonce:ciphertext string. */
export async function decrypt(stored: string): Promise<string> {
	const key = await getKey();
	const [nonceB64, ctB64] = stored.split(':');

	if (!nonceB64 || !ctB64) {
		throw new Error('Invalid encrypted format');
	}

	const nonce = Uint8Array.from(atob(nonceB64), (c) => c.charCodeAt(0));
	const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: nonce },
		key,
		ciphertext,
	);

	return new TextDecoder().decode(plaintext);
}
