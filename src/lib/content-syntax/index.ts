/**
 * Canonical syntax definitions for custom markdown directives, consumed by the remark adapter
 * (server rendering). Adding a new syntax = one entry here + one embed component registered in
 * `$lib/components/blog/embeds/registry.ts` — a directive with no component renders nothing.
 */

export interface SyntaxDefinition {
	/** remark-directive node type */
	directive: 'text' | 'leaf' | 'container';
	/** Directive name used in markdown (e.g., `::scene` or `:::callout`) */
	name: string;
	/** Attributes that must be present */
	requiredAttrs: string[];
	/** Attributes that may be present */
	optionalAttrs?: string[];
	/** Whether the directive wraps child content */
	hasContent: boolean;
	/** Maps to EmbedDescriptor.kind for client-side hydration */
	embedKind: string;
}

export const syntaxes = {
	callout: {
		directive: 'container',
		name: 'callout',
		requiredAttrs: ['type'],
		optionalAttrs: ['title'],
		hasContent: true,
		embedKind: 'callout',
	},
	scene: {
		directive: 'leaf',
		name: 'scene',
		requiredAttrs: ['src'],
		optionalAttrs: ['height', 'controls', 'alt', 'poster'],
		hasContent: false,
		embedKind: 'scene',
	},
} as const satisfies Record<string, SyntaxDefinition>;
