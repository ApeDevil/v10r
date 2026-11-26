/**
 * The one way a pasted agent or ship output is read: find exactly one fenced block whose info
 * string is the format tag, and parse its body as JSON. Everything around the block is
 * ignored — prose, other code blocks, instructions — and nothing in it is ever executed,
 * followed or rendered as markup. No parser framework: a line scan and `JSON.parse`.
 */

/** A whole paste longer than this is refused before any scanning. */
export const PASTE_MAX_CHARS = 60_000;

/** The JSON inside the block. The stored record is smaller still (its own field limits). */
export const BLOCK_MAX_CHARS = 24_000;

export type TaggedBlockRefusal = 'too_long' | 'block_missing' | 'block_repeated' | 'block_too_long' | 'not_json';

export type TaggedBlockResult = { ok: true; value: unknown } | { ok: false; refusal: TaggedBlockRefusal };

/**
 * ```<tag>
 * { ... }
 * ```
 * The fence is three or more backticks at the start of a line; the closing fence is the
 * next line holding only backticks of at least that length.
 */
export function extractTaggedBlock(paste: string, tag: string): TaggedBlockResult {
	if (paste.length > PASTE_MAX_CHARS) return { ok: false, refusal: 'too_long' };
	const lines = paste.replace(/\r\n?/g, '\n').split('\n');
	const bodies: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const open = /^(`{3,})\s*(\S+)\s*$/.exec(lines[i]);
		if (!open || open[2] !== tag) continue;
		const fence = open[1];
		const end = lines.findIndex((line, j) => j > i && /^`{3,}\s*$/.test(line) && line.trim().length >= fence.length);
		if (end === -1) continue;
		bodies.push(lines.slice(i + 1, end).join('\n'));
		i = end;
	}
	if (bodies.length === 0) return { ok: false, refusal: 'block_missing' };
	if (bodies.length > 1) return { ok: false, refusal: 'block_repeated' };
	if (bodies[0].length > BLOCK_MAX_CHARS) return { ok: false, refusal: 'block_too_long' };
	try {
		return { ok: true, value: JSON.parse(bodies[0]) };
	} catch {
		return { ok: false, refusal: 'not_json' };
	}
}

/** Bidi overrides, isolates and marks (they can make text display differently from what it says), and the Unicode line and paragraph separators, which JSON.stringify leaves unescaped. */
const BIDI_CONTROLS = new Set([
	0x2028, 0x2029, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

/** Removes C0/C1 control characters (keeping newline and tab) and bidi controls. */
export function stripInvisibleControls(value: string): string {
	let out = '';
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		const control = (code < 0x20 && code !== 0x0a && code !== 0x09) || (code >= 0x7f && code <= 0x9f);
		if (!control && !BIDI_CONTROLS.has(code)) out += char;
	}
	return out;
}
