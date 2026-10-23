/**
 * Authenticated encryption for stored credentials — AES-256-GCM via Web Crypto, under a key
 * ring so `ENCRYPTION_KEY` can be rotated without losing a single stored secret.
 *
 * Storage format: `v2:<kid>:base64(nonce):base64(ciphertext‖tag)` with a 12-byte random
 * nonce. `kid` is the first 8 hex chars of SHA-256(key) — derived, so no operator names a
 * key and a deployment cannot mislabel one. Envelopes written before the ring carry no kid
 * (`base64(nonce):base64(ciphertext‖tag)`); they still open, by trying each key of the ring.
 * Two tables hold envelopes — AI provider API keys (`ai.provider_connection`) and name-check
 * vendor secrets (`name_check.source_connection`) — so the format is a stored contract.
 *
 * The ring is an argument, never read here. `encryption-key.ts` is the one module that takes
 * it from the environment; the bare-Bun ingest scripts build it from `process.env` with
 * `tryParseKeyRing` and reach this file by relative path, which is why it imports nothing
 * that resolves through a Vite alias.
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

/**
 * The keys a deployment can open envelopes with. `current` seals everything new;
 * `previous` only opens — it exists for the window between a rotation and the re-seal sweep
 * (`jobs/encryption-reseal.ts`) that moves every envelope onto `current`.
 */
export interface EncryptionKeyRing {
	readonly current: string;
	readonly previous: readonly string[];
}

/** Obvious non-secrets that must never be used as a real key. */
const DUMMY_KEY_PATTERNS = [/^0+$/, /^(?:de)?adbeef/i, /^64-char/i, /^changeme/i, /^replace/i];

const NONCE_BYTES = 12;
const ENVELOPE_VERSION = 'v2';

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

/**
 * Build a ring from the current key and a comma-separated list of previous ones. Every key
 * is validated like the current one; a previous key equal to another is a configuration
 * fault (two names for one key), not a harmless duplicate.
 */
export function parseKeyRing(current: string | null | undefined, previousCsv?: string | null): EncryptionKeyRing {
	parseEncryptionKey(current);
	const previous = (previousCsv ?? '')
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);
	for (const key of previous) parseEncryptionKey(key);
	const all = [current as string, ...previous].map((k) => k.toLowerCase());
	if (new Set(all).size !== all.length) {
		throw new EncryptionError('invalid_key', 'ENCRYPTION_KEY_PREVIOUS repeats a key already in the ring.');
	}
	return { current: current as string, previous };
}

/** `parseKeyRing`, or null when the environment holds no usable ring — callers then report `undecryptable`. */
export function tryParseKeyRing(
	current: string | null | undefined,
	previousCsv?: string | null,
): EncryptionKeyRing | null {
	try {
		return parseKeyRing(current, previousCsv);
	} catch (err) {
		if (err instanceof EncryptionError) return null;
		throw err;
	}
}

function importKey(keyHex: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', parseEncryptionKey(keyHex), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** The key id an envelope names: first 8 hex chars of SHA-256 over the raw key bytes. */
export async function keyIdOf(keyHex: string): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', parseEncryptionKey(keyHex)));
	return Array.from(digest.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

/** Seal a plaintext string under the ring's current key. Returns `v2:<kid>:nonce:ciphertext`. */
export async function encryptAesGcm(plaintext: string, ring: EncryptionKeyRing): Promise<string> {
	const key = await importKey(ring.current);
	const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce },
		key,
		new TextEncoder().encode(plaintext),
	);
	return `${ENVELOPE_VERSION}:${await keyIdOf(ring.current)}:${toBase64(nonce)}:${toBase64(new Uint8Array(ciphertext))}`;
}

interface ParsedEnvelope {
	/** null for an envelope written before the ring — no kid, so every key is a candidate. */
	kid: string | null;
	nonce: Uint8Array<ArrayBuffer>;
	ciphertext: Uint8Array<ArrayBuffer>;
}

function parseEnvelope(stored: string): ParsedEnvelope {
	const parts = stored.split(':');
	let kid: string | null = null;
	let nonceB64: string | undefined;
	let ctB64: string | undefined;
	if (parts.length === 4 && parts[0] === ENVELOPE_VERSION) {
		[, kid, nonceB64, ctB64] = parts;
		if (!/^[0-9a-f]{8}$/.test(kid ?? '')) {
			throw new EncryptionError('malformed_ciphertext', 'Stored ciphertext names a malformed key id.');
		}
	} else if (parts.length === 2) {
		[nonceB64, ctB64] = parts;
	}
	if (!nonceB64 || !ctB64) {
		throw new EncryptionError('malformed_ciphertext', 'Stored ciphertext is not a v2:kid:nonce:ciphertext envelope.');
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
	return { kid, nonce, ciphertext };
}

async function tryOpen(envelope: ParsedEnvelope, keyHex: string): Promise<string | null> {
	try {
		const key = await importKey(keyHex);
		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.nonce }, key, envelope.ciphertext);
		return new TextDecoder().decode(plaintext);
	} catch {
		// Web Crypto reports a wrong key and a tampered envelope identically (OperationError),
		// which is the property we want: neither case yields a byte of plaintext.
		return null;
	}
}

/**
 * Open an envelope with the ring. `stale` says the envelope is not sealed under the current
 * key — opened by a previous key, or written before the ring — so the re-seal sweep should
 * move it.
 */
export async function openEnvelope(
	stored: string,
	ring: EncryptionKeyRing,
): Promise<{ plaintext: string; stale: boolean }> {
	const envelope = parseEnvelope(stored);
	const keys = [ring.current, ...ring.previous];
	const candidates = envelope.kid === null ? keys : await keysWithId(keys, envelope.kid);
	for (const keyHex of candidates) {
		const plaintext = await tryOpen(envelope, keyHex);
		if (plaintext !== null) return { plaintext, stale: envelope.kid === null || keyHex !== ring.current };
	}
	throw new EncryptionError(
		'decrypt_failed',
		envelope.kid !== null && candidates.length === 0
			? `Stored ciphertext was sealed with key ${envelope.kid}, which is not in this deployment's key ring.`
			: 'Stored ciphertext could not be decrypted with any key of the ring.',
	);
}

async function keysWithId(keys: readonly string[], kid: string): Promise<string[]> {
	const ids = await Promise.all(keys.map(keyIdOf));
	return keys.filter((_, i) => ids[i] === kid);
}

/** Open a stored envelope with the ring. */
export async function decryptAesGcm(stored: string, ring: EncryptionKeyRing): Promise<string> {
	return (await openEnvelope(stored, ring)).plaintext;
}

/**
 * The envelope re-sealed under the current key, or null when it already is. Throws like
 * `openEnvelope` when no key of the ring opens it — the sweep leaves such a row alone.
 */
export async function resealEnvelope(stored: string, ring: EncryptionKeyRing): Promise<string | null> {
	const { plaintext, stale } = await openEnvelope(stored, ring);
	return stale ? encryptAesGcm(plaintext, ring) : null;
}

/** Where a stored secret stands: `undecryptable` means an envelope exists but no key of the ring opens it. */
export type KeyStatus = 'none' | 'ready' | 'undecryptable';

/**
 * Open a stored envelope for a caller that must keep going without it. Every table that
 * holds one asks the same three-way question — nothing stored, opened, or stored but
 * unreadable under this deployment's ring — and the answer decides a status, never an
 * exception: a key dropped from the ring before the re-seal sweep finished is a
 * configuration fault the admin page has to be able to show.
 */
export async function openSecret(
	ciphertext: string | null | undefined,
	ring: EncryptionKeyRing | null,
): Promise<{ plaintext: string | null; status: KeyStatus; stale: boolean }> {
	if (!ciphertext) return { plaintext: null, status: 'none', stale: false };
	if (!ring) return { plaintext: null, status: 'undecryptable', stale: false };
	try {
		const { plaintext, stale } = await openEnvelope(ciphertext, ring);
		return { plaintext, status: 'ready', stale };
	} catch {
		return { plaintext: null, status: 'undecryptable', stale: false };
	}
}
