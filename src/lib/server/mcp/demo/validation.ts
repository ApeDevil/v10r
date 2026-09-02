/**
 * Server-side validation for demo-state mutations. Valibot schemas are the single gate:
 * both the admin MCP tools and any future caller run inputs through these, so an invalid
 * message or unsupported color is rejected before it reaches the database.
 */
import * as v from 'valibot';
import { DEMO_COLORS, MAX_MESSAGE_LENGTH } from './config';

/**
 * Message is plain text. We store it raw (never HTML-stripped, so "a < b" survives) and
 * rely on the consumers to render it as text — Svelte auto-escapes `{message}` and the MCP
 * returns it inside a text block. We only bound length and forbid control bytes that would
 * corrupt a terminal or a Postgres text value.
 */
export const messageSchema = v.pipe(
	v.string('Message must be a string.'),
	v.minLength(1, 'Message must not be empty.'),
	v.maxLength(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters.`),
	// \p{Cc} = Unicode "Control" category. Kept as a predicate (not a regex literal with raw
	// control bytes) so nothing unprintable ever appears in source. Rejects NUL, ESC, etc.
	v.check((s: string) => !/\p{Cc}/u.test(s), 'Message must not contain control characters.'),
);

export const colorSchema = v.picklist(DEMO_COLORS, `Color must be one of: ${DEMO_COLORS.join(', ')}.`);

export function parseMessage(input: unknown): { ok: true; value: string } | { ok: false; message: string } {
	const result = v.safeParse(messageSchema, input);
	if (result.success) return { ok: true, value: result.output };
	return { ok: false, message: result.issues[0]?.message ?? 'Invalid message.' };
}

export function parseColor(input: unknown): { ok: true; value: string } | { ok: false; message: string } {
	const result = v.safeParse(colorSchema, input);
	if (result.success) return { ok: true, value: result.output };
	return { ok: false, message: result.issues[0]?.message ?? 'Invalid color.' };
}
