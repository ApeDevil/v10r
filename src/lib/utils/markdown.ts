import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({
	gfm: true,
	breaks: true,
});

const ALLOWED_TAGS = [
	'p',
	'br',
	'strong',
	'em',
	'del',
	'code',
	'pre',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'blockquote',
	'a',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'hr',
	'span',
	'div',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: ALLOWED_TAGS,
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		'*': ['class'],
	},
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard',
	transformTags: {
		// External links open in a new tab with noopener+noreferrer (anti-tabnabbing).
		// Internal/relative links (e.g. Vely's own `/docs/...` references) stay in the
		// same tab so SvelteKit client-routes them — and the chatbot can minimize as the
		// destination page takes over. Only absolute http(s) URLs are treated as external.
		a: (_tagName, attribs) => {
			const href = attribs.href ?? '';
			if (/^https?:\/\//i.test(href)) {
				return {
					tagName: 'a',
					attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
				};
			}
			const { target: _dropTarget, ...rest } = attribs;
			return { tagName: 'a', attribs: rest };
		},
	},
};

// Strip control characters before sanitisation to close the historical control-char-in-href bypass class.
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — this regex strips control characters before HTML sanitisation
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

/** Parse markdown to sanitized HTML. Sync, safe for chat rendering. SSR-compatible. */
export function renderMarkdown(source: string): string {
	const cleaned = source.replace(CONTROL_CHARS_RE, '');
	const html = marked.parse(cleaned, { async: false }) as string;
	return sanitizeHtml(html, SANITIZE_OPTIONS);
}
