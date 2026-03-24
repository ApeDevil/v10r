/**
 * Canonical syntax definitions for custom markdown directives.
 * Shared between remark (server rendering) and CodeMirror (editor highlighting).
 * Adding a new syntax = add one entry here + one embed component.
 */

export interface SyntaxDefinition {
	/** remark-directive node type */
	directive: 'text' | 'leaf' | 'container';
	/** Directive name used in markdown (e.g., `::chart` or `:::callout`) */
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
	chart: {
		directive: 'leaf',
		name: 'chart',
		requiredAttrs: ['src'],
		optionalAttrs: ['type', 'height'],
		hasContent: false,
		embedKind: 'chart',
	},
	scene: {
		directive: 'leaf',
		name: 'scene',
		requiredAttrs: ['src'],
		optionalAttrs: ['height', 'controls', 'alt', 'poster'],
		hasContent: false,
		embedKind: 'scene',
	},
	video: {
		directive: 'leaf',
		name: 'video',
		requiredAttrs: ['src'],
		optionalAttrs: ['title', 'poster'],
		hasContent: false,
		embedKind: 'video',
	},
} as const satisfies Record<string, SyntaxDefinition>;

export type SyntaxName = keyof typeof syntaxes;
