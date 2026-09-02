<!--
  Prose styling for the output of the server-side markdown pipeline. It DISPLAYS
  already-rendered, already-sanitized HTML — it does not render or sanitize anything,
  which is why it can sit in the cheap barrel while the sanitiser stays on the server.

  Read by the blog, the docs viewer and the desk preview panel, which is why it lives
  here rather than inside any one of them.
-->
<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	/** Pre-sanitized HTML from the server-side markdown pipeline (`renderBlogPost`). */
	html: string;
	class?: string;
}

let { html, class: className }: Props = $props();
</script>

<article class={cn('markdown-prose', className)}>
	{@html html}
</article>

<style>
	.markdown-prose {
		line-height: 1.75;
		color: var(--color-fg);
	}

	/* Headings */
	.markdown-prose :global(h1),
	.markdown-prose :global(h2),
	.markdown-prose :global(h3),
	.markdown-prose :global(h4),
	.markdown-prose :global(h5),
	.markdown-prose :global(h6) {
		font-family: var(--font-heading);
		color: var(--color-heading);
		font-weight: 600;
		line-height: 1.3;
		margin-top: 2em;
		margin-bottom: 0.5em;
		/* TOC anchor jumps must clear the sticky chip bar the docs leaf renders on mobile. */
		scroll-margin-top: 5rem;
	}

	.markdown-prose :global(h1) { font-size: 2em; }
	.markdown-prose :global(h2) { font-size: 1.5em; }
	.markdown-prose :global(h3) { font-size: 1.25em; }
	.markdown-prose :global(h4) { font-size: 1.1em; }

	.markdown-prose :global(:first-child) {
		margin-top: 0;
	}

	/* Paragraphs */
	.markdown-prose :global(p) {
		margin-bottom: 1.25em;
	}

	.markdown-prose :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Links */
	.markdown-prose :global(a) {
		color: var(--color-primary);
		text-decoration: none;
	}

	.markdown-prose :global(a:hover) {
		text-decoration: underline;
	}

	/* Lists */
	.markdown-prose :global(ul),
	.markdown-prose :global(ol) {
		padding-left: 1.75em;
		margin-bottom: 1.25em;
	}

	.markdown-prose :global(ul) { list-style: disc; }
	.markdown-prose :global(ol) { list-style: decimal; }

	.markdown-prose :global(li) {
		margin-bottom: 0.25em;
	}

	.markdown-prose :global(li > ul),
	.markdown-prose :global(li > ol) {
		margin-top: 0.25em;
		margin-bottom: 0;
	}

	/* Blockquotes */
	.markdown-prose :global(blockquote) {
		border-left: 3px solid var(--color-primary);
		padding-left: 1em;
		margin: 1.5em 0;
		font-style: italic;
		color: var(--color-muted);
	}

	.markdown-prose :global(blockquote > p:last-child) {
		margin-bottom: 0;
	}

	/* Inline code */
	.markdown-prose :global(code) {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: 0.875em;
		background-color: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border-radius: 4px;
		padding: 0.15em 0.4em;
	}

	/* Code blocks (Shiki) */
	.markdown-prose :global(pre) {
		margin: 1.5em 0;
		border-radius: var(--radius-md, 8px);
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
		overflow-x: auto;
	}

	.markdown-prose :global(pre > code) {
		display: block;
		padding: 1em 1.25em;
		background: none;
		border-radius: 0;
		font-size: 0.85em;
		line-height: 1.6;
	}

	/* Tables */
	.markdown-prose :global(table) {
		border-collapse: collapse;
		margin: 1.5em 0;
		width: 100%;
		font-size: 0.9em;
	}

	.markdown-prose :global(th),
	.markdown-prose :global(td) {
		border: 1px solid var(--color-border);
		padding: 0.5em 0.75em;
		text-align: left;
	}

	.markdown-prose :global(th) {
		font-weight: 600;
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	/* Images */
	.markdown-prose :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md, 8px);
		margin: 1.5em 0;
	}

	/* Horizontal rules */
	.markdown-prose :global(hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 2em 0;
	}

	/* Strong / emphasis */
	.markdown-prose :global(strong) {
		font-weight: 600;
		color: var(--color-heading);
	}

	.markdown-prose :global(del) {
		text-decoration: line-through;
		opacity: 0.7;
	}

	/* Task lists (GFM) */
	.markdown-prose :global(ul:has(> li > input[type="checkbox"])) {
		list-style: none;
		padding-left: 0.5em;
	}

	.markdown-prose :global(li > input[type="checkbox"]) {
		margin-right: 0.5em;
	}

	/* Embed placeholders */
	.markdown-prose :global([data-embed-kind]) {
		margin: 1.5em 0;
		padding: 1.5em;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md, 8px);
		text-align: center;
		color: var(--color-muted);
		font-size: 0.875em;
	}

	.markdown-prose :global([data-embed-kind])::before {
		content: attr(data-embed-kind) ' embed';
		display: block;
		font-weight: 500;
		text-transform: capitalize;
	}

	/* Embed warnings */
	.markdown-prose :global(.embed-warning) {
		margin: 1.5em 0;
		padding: 1em;
		border: 1px solid var(--color-error, #ef4444);
		border-radius: var(--radius-md, 8px);
		background-color: color-mix(in srgb, var(--color-error, #ef4444) 8%, transparent);
		color: var(--color-error-fg, #ef4444);
		font-size: 0.875em;
	}
</style>
