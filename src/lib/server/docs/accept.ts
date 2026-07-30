/**
 * Content-negotiation predicate for the `.md` docs layer.
 *
 * True only when the caller EXPLICITLY prefers markdown over HTML. Wildcards never
 * count — curl's default Accept (a bare wildcard) must not negotiate, and a browser
 * navigation (`sec-fetch-dest: document`) never negotiates regardless of its Accept.
 * Mirrors the precedence style of isDocumentRequest in $lib/server/api/rate-limit.ts.
 */

const MARKDOWN_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);

export function prefersMarkdown(headers: Headers): boolean {
	if (headers.get('sec-fetch-dest') === 'document') return false;
	const accept = headers.get('accept');
	if (!accept) return false;

	let markdownQ = 0;
	let htmlQ = 0;
	for (const part of accept.split(',')) {
		const [rawType, ...params] = part.split(';');
		const type = rawType.trim().toLowerCase();
		// Wildcards are ignored entirely: they express indifference, not preference.
		if (type === '*/*' || type === 'text/*') continue;
		let q = 1;
		for (const param of params) {
			const [key, value] = param.split('=');
			if (key?.trim().toLowerCase() === 'q') {
				const parsed = Number.parseFloat(value?.trim() ?? '');
				if (Number.isFinite(parsed)) q = parsed;
			}
		}
		if (MARKDOWN_TYPES.has(type)) markdownQ = Math.max(markdownQ, q);
		else if (HTML_TYPES.has(type)) htmlQ = Math.max(htmlQ, q);
	}
	return markdownQ > 0 && markdownQ >= htmlQ;
}
