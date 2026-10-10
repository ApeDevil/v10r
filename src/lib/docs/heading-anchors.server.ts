/**
 * The anchors a markdown document's headings render to, computed by the same libraries the
 * docs renderer uses (`remark-parse` → `remark-rehype` → `rehype-slug`, i.e. github-slugger,
 * including its `-1` de-duplication). A second, hand-written slugger would be a mirror that
 * agrees until the first heading with an underscore or a non-ASCII letter. Known gap: the blog
 * renderer also runs the content-syntax directives; a heading that contains directive syntax
 * may slug differently here. Readers: `pattern-library/validate.ts` (the anchor gate) and the
 * pattern pages' README TOC (`patterns/render.ts`).
 *
 * Vite-free leaf (no `$lib`, no `$env`) so `pattern-library/validate.ts` can import it by
 * relative path under bare Bun. It lives outside the server domains so the patterns domain
 * and the validator can share it without reaching into another domain's internals, and is
 * `.server.ts` so SvelteKit refuses it in any client bundle (it pulls the unified toolchain).
 */
import type { Element, Root } from 'hast';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const processor = unified().use(remarkParse).use(remarkFrontmatter).use(remarkGfm).use(remarkRehype).use(rehypeSlug);

const HEADING = /^h[1-6]$/;

export function headingAnchors(markdown: string): Set<string> {
	const tree = processor.runSync(processor.parse(markdown)) as Root;
	const anchors = new Set<string>();
	visit(tree, 'element', (node: Element) => {
		if (HEADING.test(node.tagName) && typeof node.properties?.id === 'string') anchors.add(node.properties.id);
	});
	return anchors;
}
