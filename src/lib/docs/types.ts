export type DocSection = 'foundation' | 'blueprint' | 'stack';

export interface DocEntry {
	section: DocSection;
	slug: string;
	title: string;
	description: string;
	sourcePath: string;
	layer?: string;
	group?: string;
	order?: number;
	published: boolean;
}

export interface DocsManifest {
	foundation: DocEntry[];
	blueprint: DocEntry[];
	stack: DocEntry[];
}

export const STACK_LAYER_ORDER = [
	'core',
	'data',
	'auth',
	'ui',
	'forms',
	'ai',
	'i18n',
	'quality',
	'notifications',
	'ops',
	'capabilities',
] as const;

export type StackLayer = (typeof STACK_LAYER_ORDER)[number];
