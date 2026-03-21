import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetIcons, presetUno } from 'unocss';
import { borderRadius, breakpoints, colors, containers, fontFamily, fontSize, iconSize, spacing, zIndex } from './src/lib/styles/tokens';

export default defineConfig({
	presets: [
		presetUno(),
		presetIcons({
			collections: {
				lucide: () => import('@iconify-json/lucide/icons.json').then((i) => i.default),
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

	// Safelist commonly used dynamic classes
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
		// Desk panel icons (used programmatically via activity bar data)
		'i-lucide-notebook-pen',
		'i-lucide-pen-tool',
		'i-lucide-terminal',
		'i-lucide-image',
		'i-lucide-inbox',
		'i-lucide-bar-chart-3',
		'i-lucide-panel-top',
		'i-lucide-message-circle',
		'i-lucide-send',
		'i-lucide-sheet',
		'i-lucide-folder-tree',
		'i-lucide-folder',
		'i-lucide-folder-open',
		'i-lucide-file',
		'i-lucide-file-code',
		'i-lucide-file-text',
		'i-lucide-file-plus',
		'i-lucide-folder-plus',
		'i-lucide-refresh-cw',
		'i-lucide-dices',
		'i-lucide-lock',
		'i-lucide-unlock',
	],
});
