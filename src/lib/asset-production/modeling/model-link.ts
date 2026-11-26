/**
 * A model link: the whole parametric model inside the URL fragment, so opening it needs no
 * database, no object store and no server-side id — and the fragment never reaches a server's
 * access log, because browsers do not send it.
 *
 *   https://www.v10r.dev/3d/view#m1.<base64url(deflate-raw(canonical JSON))>
 *
 * `m1` names this encoding and the model format it carries (version 1). Equal models give equal
 * links: the JSON is canonical (sorted keys, no whitespace) and fflate's deflate is pure
 * JavaScript, so the bytes do not depend on the browser or runtime.
 *
 * Decoding is bounded before it allocates: the encoded length is capped, the inflater stops at
 * `MODELING_LIMITS.maxModelBytes` of output (a compression bomb fails at 16 KiB, not at its
 * claimed size), and the decompression ratio is capped. The result is untrusted JSON — the
 * caller still runs it through the model schema.
 *
 * A link is not encrypted and not access-controlled: anyone holding it can rebuild the model.
 */
import { deflateSync, Inflate } from 'fflate';
import { MODELING_LIMITS } from '#lib/schemas/parametric-model.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';

export const MODEL_LINK_PREFIX = 'm1.';

/** Longest fragment payload accepted: well inside what browsers and chat hosts keep in a link. */
export const MAX_MODEL_LINK_CHARS = 8_000;

/** Refused beyond this inflate ratio: real models compress 2–6×, bombs 100×+. */
export const MAX_MODEL_LINK_RATIO = 40;

export type ModelLinkFailure = 'not-a-model-link' | 'unsupported-version' | 'too-long' | 'malformed' | 'too-large';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
		const chars = i + 1 >= bytes.length ? 2 : i + 2 >= bytes.length ? 3 : 4;
		for (let c = 0; c < chars; c++) out += ALPHABET[(n >> (18 - 6 * c)) & 63];
	}
	return out;
}

function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
	const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
	let bits = 0;
	let value = 0;
	let o = 0;
	for (const char of text) {
		value = (value << 6) | ALPHABET.indexOf(char);
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes[o++] = (value >> bits) & 255;
		}
	}
	return bytes.subarray(0, o);
}

/** The fragment payload (`m1.…`) for `model`. Throws when the model is over the link budget. */
export function encodeModelLink(model: unknown): string {
	const json = new TextEncoder().encode(canonicalJson(model));
	const payload = MODEL_LINK_PREFIX + toBase64Url(deflateSync(json, { level: 9 }));
	if (payload.length > MAX_MODEL_LINK_CHARS) throw new RangeError('model-link-too-long');
	return payload;
}

/** Like `encodeModelLink`, but `null` instead of a throw when the model is over the budget. */
export function tryEncodeModelLink(model: unknown): string | null {
	try {
		return encodeModelLink(model);
	} catch {
		return null;
	}
}

/** The model a fragment carries, as untrusted JSON, or why there is none. */
export function decodeModelLink(
	fragment: string,
): { ok: true; value: unknown } | { ok: false; reason: ModelLinkFailure } {
	const payload = fragment.startsWith('#') ? fragment.slice(1) : fragment;
	if (!/^m\d+\./.test(payload)) return { ok: false, reason: 'not-a-model-link' };
	if (!payload.startsWith(MODEL_LINK_PREFIX)) return { ok: false, reason: 'unsupported-version' };
	if (payload.length > MAX_MODEL_LINK_CHARS) return { ok: false, reason: 'too-long' };
	const compressed = fromBase64Url(payload.slice(MODEL_LINK_PREFIX.length));
	if (!compressed || compressed.length === 0) return { ok: false, reason: 'malformed' };

	const limit = Math.min(MODELING_LIMITS.maxModelBytes, compressed.length * MAX_MODEL_LINK_RATIO);
	const chunks: Uint8Array[] = [];
	let size = 0;
	let overflow = false;
	try {
		const inflater = new Inflate((chunk) => {
			size += chunk.length;
			if (size > limit) {
				overflow = true;
				throw new RangeError('inflate-limit');
			}
			chunks.push(chunk.slice());
		});
		inflater.push(compressed, true);
	} catch {
		return { ok: false, reason: overflow ? 'too-large' : 'malformed' };
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	try {
		return { ok: true, value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
	} catch {
		return { ok: false, reason: 'malformed' };
	}
}

/** The viewer URL for a fragment payload on `origin`. */
export const modelViewerUrl = (origin: string, payload: string) => `${origin}/3d/view#${payload}`;
