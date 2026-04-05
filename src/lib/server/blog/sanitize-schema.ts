/**
 * Custom rehype-sanitize schema for blog content.
 * Extends the default GitHub schema to allow:
 * - Embed placeholder attributes (data-embed-*)
 * - Heading IDs from rehype-slug
 * - Shiki syntax highlighting classes/styles (safe properties only)
 */
import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';
import { visit } from 'unist-util-visit';
import type { Root as HastRoot, Element } from 'hast';
import type { Plugin } from 'unified';

function mergeArrays(existing: string[] | undefined, additions: string[]): string[] {
	return [...(existing ?? []), ...additions];
}

/**
 * CSS properties safe for Shiki syntax highlighting.
 * Blocks dangerous properties: url(), position, z-index, display, expression().
 */
const SAFE_CSS_PROPERTIES = new Set([
	'color',
	'background-color',
	'font-style',
	'font-weight',
	'text-decoration',
	'text-decoration-line',
	'text-decoration-style',
	'opacity',
]);

/** Sanitize inline style to only safe CSS properties. */
export function sanitizeStyle(style: string): string {
	return style
		.split(';')
		.map((decl) => decl.trim())
		.filter((decl) => {
			if (!decl) return false;
			const colonIdx = decl.indexOf(':');
			if (colonIdx === -1) return false;
			const prop = decl.slice(0, colonIdx).trim().toLowerCase();
			const value = decl.slice(colonIdx + 1).trim().toLowerCase();
			// Block url(), expression(), and other dangerous CSS values
			if (/\b(url|expression|javascript)\s*\(/.test(value)) return false;
			return SAFE_CSS_PROPERTIES.has(prop);
		})
		.join('; ');
}

/** Rehype plugin that sanitizes style attributes to safe CSS properties only. */
export const rehypeSanitizeStyles: Plugin<[], HastRoot> = () => {
	return (tree: HastRoot) => {
		visit(tree, 'element', (node: Element) => {
			const style = node.properties?.style;
			if (typeof style !== 'string') return;
			const sanitized = sanitizeStyle(style);
			if (sanitized) {
				node.properties.style = sanitized;
			} else {
				delete node.properties.style;
			}
		});
	};
}

export const blogSanitizeSchema: Schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		div: mergeArrays(defaultSchema.attributes?.div as string[] | undefined, [
			'dataEmbedId',
			'data-embed-id',
			'dataEmbedKind',
			'data-embed-kind',
			'dataEmbedAttrs',
			'data-embed-attrs',
			'className',
		]),
		span: mergeArrays(defaultSchema.attributes?.span as string[] | undefined, [
			'className',
		]),
		pre: mergeArrays(defaultSchema.attributes?.pre as string[] | undefined, [
			'className',
			'style',
			'tabIndex',
		]),
		code: mergeArrays(defaultSchema.attributes?.code as string[] | undefined, [
			'className',
			'style',
		]),
		// Allow id on all elements (heading IDs from rehype-slug)
		'*': mergeArrays(defaultSchema.attributes?.['*'] as string[] | undefined, ['id']),
	},
	tagNames: mergeArrays(defaultSchema.tagNames ?? undefined, ['section', 'figure', 'figcaption']),
};
