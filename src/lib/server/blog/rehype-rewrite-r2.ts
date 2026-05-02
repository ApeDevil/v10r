import type { Element, Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const R2_HOST_RE = /^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\/(blog\/[^?]+)/;

/**
 * Rewrite legacy presigned R2 URLs on `<img>` tags to stable `/api/blog/media/...`
 * proxy paths. Matches `https://*.r2.cloudflarestorage.com/blog/uuid.ext?X-Amz-...`
 * and rewrites to `/api/blog/media/blog/uuid.ext`.
 */
export const rehypeRewriteR2: Plugin<[], HastRoot> = () => {
	return (tree: HastRoot) => {
		visit(tree, 'element', (node: Element) => {
			if (node.tagName !== 'img') return;
			const src = node.properties?.src;
			if (typeof src !== 'string') return;
			const match = R2_HOST_RE.exec(src);
			if (!match) return;
			node.properties.src = `/api/blog/media/${match[1]}`;
		});
	};
};
