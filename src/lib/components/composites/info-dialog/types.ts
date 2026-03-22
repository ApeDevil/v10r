import type { Snippet } from 'svelte';

/** A single property definition for PropsTable */
export interface PropDef {
	name: string;
	type: string;
	default?: string;
	required?: boolean;
	description: string;
}

/** A named content section for tabbed mode */
export interface InfoSection {
	id: string;
	label: string;
	icon?: string;
	content: Snippet;
}

/** Pre-highlighted code block data (from server-side Shiki) */
export interface HighlightedCode {
	/** Shiki-generated HTML with dual-theme CSS variables */
	html: string;
	language: string;
	filename?: string;
}

/** Structured documentation data model */
export interface ComponentDoc {
	name: string;
	description?: string;
	props?: PropDef[];
	source?: HighlightedCode;
	usage?: HighlightedCode;
	/** Markdown-formatted notes */
	notes?: string;
}
