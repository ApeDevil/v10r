/**
 * Custom rehype-sanitize schema for blog content.
 * Extends the default GitHub schema to allow:
 * - Embed placeholder attributes (data-embed-*)
 * - Heading IDs from rehype-slug
 * - Shiki syntax highlighting classes/styles
 */
import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'rehype-sanitize';

function mergeArrays(existing: string[] | undefined, additions: string[]): string[] {
	return [...(existing ?? []), ...additions];
}

export const blogSanitizeSchema: Schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		div: mergeArrays(defaultSchema.attributes?.div as string[] | undefined, [
			'dataEmbedId',
			'dataEmbedKind',
			'dataEmbedAttrs',
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
	tagNames: mergeArrays(defaultSchema.tagNames, ['section', 'figure', 'figcaption']),
};
