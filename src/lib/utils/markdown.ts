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
		// Force noopener+noreferrer and _blank on every <a>. Belt-and-suspenders against tabnabbing.
		a: (_tagName, attribs) => ({
			tagName: 'a',
			attribs: {
				...attribs,
				rel: 'noopener noreferrer',
				target: '_blank',
			},
		}),
	},
};

// Strip control characters before sanitisation to close the historical control-char-in-href bypass class.
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

/** Parse markdown to sanitized HTML. Sync, safe for chat rendering. SSR-compatible. */
export function renderMarkdown(source: string): string {
	const cleaned = source.replace(CONTROL_CHARS_RE, '');
	const html = marked.parse(cleaned, { async: false }) as string;
	return sanitizeHtml(html, SANITIZE_OPTIONS);
}
