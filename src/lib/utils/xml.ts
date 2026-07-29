/**
 * XML escaping for prompt assembly.
 *
 * Lives in `$lib/utils` rather than beside the prompt builder because the
 * retrieval layer needs it too, and `$lib/server/ai` already imports
 * `$lib/server/rawrag` — reaching back the other way would close a cycle.
 */

/** Escape XML-special characters to prevent attribute breakout in system prompts. */
export function escapeXmlAttr(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Escape for an XML TEXT NODE — only the three characters that can end an
 * element early. Quotes and apostrophes are left alone on purpose: they cannot
 * cause a breakout outside an attribute, and rewriting every apostrophe in a
 * user's prose or code to `&apos;` degrades what the model actually reads.
 */
export function escapeXmlText(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
