<script lang="ts">
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '$lib/utils/cn';

interface Props {
	html: string;
	embeds?: unknown;
	class?: string;
}

let { html, embeds, class: className }: Props = $props();

/**
 * Rewrite legacy presigned R2 URLs to stable proxy URLs.
 * Matches: https://*.r2.cloudflarestorage.com/blog/uuid.ext?X-Amz-...
 * Rewrites to: /api/blog/media/blog/uuid.ext
 */
const R2_IMG_RE = /https:\/\/[^"'\s]+\.r2\.cloudflarestorage\.com\/(blog\/[^"'\s?]+)\?[^"'\s]*/g;

const safeHtml = $derived(
	DOMPurify.sanitize(html.replace(R2_IMG_RE, (_match, key) => `/api/blog/media/${key}`), {
		ADD_TAGS: ['iframe'],
		ADD_ATTR: ['target', 'rel', 'data-embed-kind', 'loading', 'allowfullscreen'],
		FORBID_TAGS: ['script', 'style'],
	})
);
</script>

<article class={cn('blog-prose', className)}>
	{@html safeHtml}
</article>

<style>
	.blog-prose {
		line-height: 1.75;
		color: var(--color-fg);
	}

	/* Headings */
	.blog-prose :global(h1),
	.blog-prose :global(h2),
	.blog-prose :global(h3),
	.blog-prose :global(h4),
	.blog-prose :global(h5),
	.blog-prose :global(h6) {
		font-family: var(--font-heading);
		color: var(--color-heading);
		font-weight: 600;
		line-height: 1.3;
		margin-top: 2em;
		margin-bottom: 0.5em;
	}

	.blog-prose :global(h1) { font-size: 2em; }
	.blog-prose :global(h2) { font-size: 1.5em; }
	.blog-prose :global(h3) { font-size: 1.25em; }
	.blog-prose :global(h4) { font-size: 1.1em; }

	.blog-prose :global(:first-child) {
		margin-top: 0;
	}

	/* Paragraphs */
	.blog-prose :global(p) {
		margin-bottom: 1.25em;
	}

	.blog-prose :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Links */
	.blog-prose :global(a) {
		color: var(--color-primary);
		text-decoration: none;
	}

	.blog-prose :global(a:hover) {
		text-decoration: underline;
	}

	/* Lists */
	.blog-prose :global(ul),
	.blog-prose :global(ol) {
		padding-left: 1.75em;
		margin-bottom: 1.25em;
	}

	.blog-prose :global(ul) { list-style: disc; }
	.blog-prose :global(ol) { list-style: decimal; }

	.blog-prose :global(li) {
		margin-bottom: 0.25em;
	}

	.blog-prose :global(li > ul),
	.blog-prose :global(li > ol) {
		margin-top: 0.25em;
		margin-bottom: 0;
	}

	/* Blockquotes */
	.blog-prose :global(blockquote) {
		border-left: 3px solid var(--color-primary);
		padding-left: 1em;
		margin: 1.5em 0;
		font-style: italic;
		color: var(--color-muted);
	}

	.blog-prose :global(blockquote > p:last-child) {
		margin-bottom: 0;
	}

	/* Inline code */
	.blog-prose :global(code) {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: 0.875em;
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border-radius: 4px;
		padding: 0.15em 0.4em;
	}

	/* Code blocks (Shiki) */
	.blog-prose :global(pre) {
		margin: 1.5em 0;
		border-radius: var(--radius-md, 8px);
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
		overflow-x: auto;
	}

	.blog-prose :global(pre > code) {
		display: block;
		padding: 1em 1.25em;
		background: none;
		border-radius: 0;
		font-size: 0.85em;
		line-height: 1.6;
	}

	/* Tables */
	.blog-prose :global(table) {
		border-collapse: collapse;
		margin: 1.5em 0;
		width: 100%;
		font-size: 0.9em;
	}

	.blog-prose :global(th),
	.blog-prose :global(td) {
		border: 1px solid var(--color-border);
		padding: 0.5em 0.75em;
		text-align: left;
	}

	.blog-prose :global(th) {
		font-weight: 600;
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	/* Images */
	.blog-prose :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md, 8px);
		margin: 1.5em 0;
	}

	/* Horizontal rules */
	.blog-prose :global(hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 2em 0;
	}

	/* Strong / emphasis */
	.blog-prose :global(strong) {
		font-weight: 600;
		color: var(--color-heading);
	}

	.blog-prose :global(del) {
		text-decoration: line-through;
		opacity: 0.7;
	}

	/* Task lists (GFM) */
	.blog-prose :global(ul:has(> li > input[type="checkbox"])) {
		list-style: none;
		padding-left: 0.5em;
	}

	.blog-prose :global(li > input[type="checkbox"]) {
		margin-right: 0.5em;
	}

	/* Embed placeholders */
	.blog-prose :global([data-embed-kind]) {
		margin: 1.5em 0;
		padding: 1.5em;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md, 8px);
		text-align: center;
		color: var(--color-muted);
		font-size: 0.875em;
	}

	.blog-prose :global([data-embed-kind])::before {
		content: attr(data-embed-kind) ' embed';
		display: block;
		font-weight: 500;
		text-transform: capitalize;
	}

	/* Embed warnings */
	.blog-prose :global(.embed-warning) {
		margin: 1.5em 0;
		padding: 1em;
		border: 1px solid var(--color-error, #ef4444);
		border-radius: var(--radius-md, 8px);
		background-color: color-mix(in srgb, var(--color-error, #ef4444) 8%, transparent);
		color: var(--color-error-fg, #ef4444);
		font-size: 0.875em;
	}
</style>
