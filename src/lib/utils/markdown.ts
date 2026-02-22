import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
	gfm: true,
	breaks: true,
});

const ALLOWED_TAGS = [
	'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
	'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'ul', 'ol', 'li', 'blockquote',
	'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
	'hr', 'span', 'div',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

/** Parse markdown to sanitized HTML. Sync, safe for chat rendering. */
export function renderMarkdown(source: string): string {
	const html = marked.parse(source, { async: false }) as string;
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		FORBID_TAGS: ['script', 'iframe', 'img'],
	});
}
