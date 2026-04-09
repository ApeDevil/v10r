/**
 * Blog markdown rendering pipeline.
 * Converts raw markdown into cached HTML + embed descriptors + TOC.
 * Lazy-initialized — the unified processor is built on first call and cached.
 */

import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import type { Element, Root as HastRoot } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkExtractFrontmatter from 'remark-extract-frontmatter';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type Processor, unified } from 'unified';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';
import { remarkDirectiveHandlers } from '$lib/content-syntax/remark-adapter';
import { getHighlighter } from '$lib/server/shiki';
import { blogSanitizeSchema, rehypeSanitizeStyles } from './sanitize-schema';
import type { EmbedDescriptor, TocEntry } from './types';

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

// unified chain loses generic precision after many .use() calls
type BlogProcessor = Processor<Node, Node, Node, Node, string>;
let processorPromise: Promise<BlogProcessor> | null = null;

async function buildProcessor(): Promise<BlogProcessor> {
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
		.use(rehypeStringify) as unknown as BlogProcessor;
}

function getProcessor(): Promise<BlogProcessor> {
	if (!processorPromise) {
		processorPromise = buildProcessor();
	}
	return processorPromise;
}

// ── Public API ──────────────────────────────────────────────────────

export async function renderBlogPost(markdown: string, _permalinks?: string[]): Promise<RenderResult> {
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
