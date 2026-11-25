/**
 * The complete outgoing arguments of an external operation, as the approval card shows them
 * beside the compact preview (`content-screen.ts` `previewExternalArguments`).
 *
 * The preview shortens values so a card reads at a glance; this is the whole thing, so the
 * user can inspect every byte the approval authorizes before approving. It is the same value the
 * approval binds: `digest` is the binding's `argumentsDigest` (sha-256 of the canonical JSON), and
 * parsing `document` back gives a value whose canonical JSON hashes to it — the inspection and
 * the authorization cannot describe two different payloads.
 *
 * "Sanitized" means two things, neither of which changes the value:
 *  - the arguments already passed the content screen, so no deployment secret or
 *    credential-shaped string is in them (those are refused before any card exists);
 *  - characters a reader cannot see — controls, zero-width and bidirectional overrides — are
 *    written as `\uXXXX` escapes, so a value cannot hide or reorder text on screen. The escapes
 *    are valid JSON for the same characters.
 *
 * Size is bounded where it is decided: `prepareExternalOperation` refuses arguments over
 * `MAX_EXTERNAL_ARGUMENT_BYTES`, so every card can carry its document whole — nothing that is
 * sent is ever left out of the inspection.
 */
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import type { ExternalEnvelopeField } from './contract';

/**
 * Bytes of canonical JSON arguments any external operation may send. Above the MCP peers' own
 * ceiling (32 KiB, `mcp-client/config.ts`) so it binds only A2A delegation models that would be
 * too large to inspect on a card.
 */
export const MAX_EXTERNAL_ARGUMENT_BYTES = 64 * 1024;

export interface ExternalOutgoingArguments {
	/** The arguments, pretty-printed with sorted keys; invisible characters escaped. */
	document: string;
	/** sha-256 of the canonical JSON — the approval binding's `argumentsDigest`. */
	digest: string;
	/** UTF-8 bytes of the canonical JSON, the size the peer receives. */
	bytes: number;
	/** Values the protocol adds to the request that are not arguments. */
	envelope: ExternalEnvelopeField[];
}

/** DEL and C1 controls (JSON.stringify escapes C0), soft hyphen, zero-width, bidi marks and overrides, BOM. */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
	[0x7f, 0x9f],
	[0xad, 0xad],
	[0x61c, 0x61c],
	[0x180e, 0x180e],
	[0x200b, 0x200f],
	[0x202a, 0x202e],
	[0x2060, 0x2064],
	[0x2066, 0x206f],
	[0xfeff, 0xfeff],
];

const invisible = (code: number) => INVISIBLE_RANGES.some(([from, to]) => code >= from && code <= to);

/** Every invisible character of `text` as a JSON `\uXXXX` escape. */
function escapeInvisible(text: string): string {
	let out = '';
	for (const char of text) {
		const code = char.charCodeAt(0);
		out += char.length === 1 && invisible(code) ? `\\u${code.toString(16).padStart(4, '0')}` : char;
	}
	return out;
}

/** Canonical key order (`canonicalJson`), indented for reading. */
function sortedDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortedDeep);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, inner]) => inner !== undefined)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				.map(([key, inner]) => [key, sortedDeep(inner)]),
		);
	}
	return value;
}

/** The arguments as the card shows them in full. */
export function externalOutgoingDocument(args: unknown): string {
	return escapeInvisible(JSON.stringify(sortedDeep(args), null, 2));
}

/** UTF-8 bytes of the canonical JSON of `args`. */
export function externalArgumentBytes(args: unknown): number {
	return Buffer.byteLength(canonicalJson(args));
}
