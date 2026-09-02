import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetIcons, presetUno } from 'unocss';
import { ICON_OPTIONS } from './src/lib/styles/icon-options.ts';
import {
	borderRadius,
	boxShadow,
	breakpoints,
	colors,
	containers,
	fontFamily,
	fontSize,
	iconSize,
	spacing,
	zIndex,
} from './src/lib/styles/tokens.ts';

// Lucide icons that CANNOT be statically extracted from source: either passed
// via a dynamic prop with no `i-lucide-*` literal (e.g. the `EmptyState
// icon="lucide:inbox"` demo) or otherwise not present verbatim in the tree.
// Everything else is auto-extracted via `content.pipeline.include: 'src/**/*.ts'`
// (plus svelte/html), so no icon needs to be hand-listed here. DB-authored icons
// (blog domain/tag) come from ICON_OPTIONS below.
const EDGE_ICONS = ['i-lucide-folder-open', 'i-lucide-inbox', 'i-lucide-notebook-pen', 'i-lucide-unlock'];

export default defineConfig({
	presets: [
		presetUno(),
		presetIcons({
			collections: {
				lucide: () => import('@iconify-json/lucide/icons.json', { with: { type: 'json' } }).then((i) => i.default),
			},
			scale: 1.2,
			warn: true,
		}),
	],

	transformers: [transformerDirectives()],

	content: {
		pipeline: {
			include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/, 'src/**/*.ts'],
		},
	},

	theme: {
		breakpoints,
		containers,
		fontSize: {
			...fontSize,
			...iconSize,
		},
		spacing,
		fontFamily,
		colors,
		borderRadius,
		boxShadow,
		zIndex,
	},

	// Custom rules for duration utilities
	rules: [
		['duration-instant', { 'transition-duration': 'var(--duration-instant, 0ms)' }],
		['duration-fast', { 'transition-duration': 'var(--duration-fast, 150ms)' }],
		['duration-normal', { 'transition-duration': 'var(--duration-normal, 250ms)' }],
		['duration-slow', { 'transition-duration': 'var(--duration-slow, 400ms)' }],
		['duration-slower', { 'transition-duration': 'var(--duration-slower, 600ms)' }],
	],

	// Decorative background utilities
	shortcuts: {
		'bg-dots': 'bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] bg-[length:20px_20px]',
		'bg-grid':
			'bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(to_right,currentColor_1px,transparent_1px)] bg-[length:30px_30px]',
	},

	// Safelist dynamic classes that can't be statically extracted.
	safelist: [
		...Object.keys(fontSize).map((k) => `text-${k}`),
		...Object.keys(iconSize).map((k) => `text-${k}`),
		...Object.keys(spacing).flatMap((k) => [`p-${k}`, `m-${k}`, `gap-${k}`]),
		// Typography colors
		'color-body',
		'color-heading',
		// Elevation surfaces
		'bg-surface-1',
		'bg-surface-2',
		'bg-surface-3',
		// Icons: DB-authored (admin picker SSOT) + a few dynamic edge cases.
		...ICON_OPTIONS.map((o) => o.class),
		...EDGE_ICONS,
	],
});
