/**
 * Token encryption — AES-256-GCM via Web Crypto API.
 * Storage format: base64(nonce):base64(ciphertext)
 */
import { env } from '$env/dynamic/private';

/** Obvious non-secrets that must never reach production as a real key. */
const DUMMY_KEY_PATTERNS = [/^0+$/, /^(?:de)?adbeef/i, /^64-char/i, /^changeme/i, /^replace/i];

/**
 * Fail at boot, not at first use.
 *
 * `getKey()` only throws when something is actually encrypted, so a misconfigured
 * deployment looked healthy until the first Discord link — and a placeholder key
 * would have "worked" indefinitely while providing no confidentiality at all.
 * Mirrors abuse/config.ts's assertProductionConfig().
 */
function assertProductionConfig(): void {
	if (process.env.NODE_ENV !== 'production') return;
	const key = env.ENCRYPTION_KEY;
	if (!key || key.length !== 64) {
		throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes) in production.');
	}
	if (!/^[0-9a-f]{64}$/i.test(key)) {
		throw new Error('ENCRYPTION_KEY must be hex. Generate with: openssl rand -hex 32');
	}
	if (DUMMY_KEY_PATTERNS.some((rx) => rx.test(key))) {
		throw new Error('ENCRYPTION_KEY looks like a placeholder. Generate with: openssl rand -hex 32');
	}
}
assertProductionConfig();

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

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoded);

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

	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);

	return new TextDecoder().decode(plaintext);
}
