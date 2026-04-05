/**
 * Blog markdown rendering pipeline.
 * Converts raw markdown into cached HTML + embed descriptors + TOC.
 * Lazy-initialized — the unified processor is built on first call and cached.
 */
import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkExtractFrontmatter from 'remark-extract-frontmatter';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { parse as parseYaml } from 'yaml';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';

import { getHighlighter } from '$lib/server/shiki';
import { remarkDirectiveHandlers } from '$lib/content-syntax/remark-adapter';
import { blogSanitizeSchema, rehypeSanitizeStyles } from './sanitize-schema';
import type { EmbedDescriptor, TocEntry } from './types';
import type { Element, Root as HastRoot } from 'hast';

export interface RenderResult {
	html: string;
	embeds: EmbedDescriptor[];
	toc: TocEntry[];
	frontmatter: Record<string, unknown>;
}

// ── Custom rehype plugin: TOC extraction ────────────────────────────

function rehypeToc() {
	return (tree: HastRoot, file: { data: Record<string, unknown> }) => {
		const toc: TocEntry[] = [];

		visit(tree, 'element', (node: Element) => {
			const match = /^h([1-6])$/.exec(node.tagName);
			if (!match) return;

			const depth = Number.parseInt(match[1], 10);
			const id = (node.properties?.id as string) ?? '';
			const text = hastToString(node);

			if (id && text) {
				toc.push({ depth, id, text });
			}
		});

		file.data.toc = toc;
	};
}

// ── Lazy pipeline initialization ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unified chain loses generic precision after many .use() calls
let processorPromise: Promise<Processor<any, any, any, any, any>> | null = null;

async function buildProcessor(): Promise<Processor<any, any, any, any, any>> {
	const highlighter = await getHighlighter();

	return unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkExtractFrontmatter, { yaml: parseYaml })
		.use(remarkDirective)
		.use(remarkDirectiveHandlers)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeSlug)
		.use(rehypeToc)
		.use(rehypeShikiFromHighlighter, highlighter, {
			themes: { light: 'github-light', dark: 'github-dark' },
		})
		.use(rehypeSanitize, blogSanitizeSchema)
		.use(rehypeSanitizeStyles)
		.use(rehypeStringify);
}

function getProcessor(): Promise<Processor<any, any, any, any, any>> {
	if (!processorPromise) {
		processorPromise = buildProcessor();
	}
	return processorPromise;
}

// ── Public API ──────────────────────────────────────────────────────

export async function renderBlogPost(
	markdown: string,
	_permalinks?: string[],
): Promise<RenderResult> {
	try {
		const processor = await getProcessor();
		const result = await processor.process(markdown);

		return {
			html: String(result),
			embeds: (result.data.embeds as EmbedDescriptor[]) ?? [],
			toc: (result.data.toc as TocEntry[]) ?? [],
			frontmatter: (result.data.frontmatter as Record<string, unknown>) ?? {},
		};
	} catch (error) {
		console.warn('[blog/pipeline] Render failed:', error);
		return {
			html: '<p class="render-error">Failed to render content.</p>',
			embeds: [],
			toc: [],
			frontmatter: {},
		};
	}
}
