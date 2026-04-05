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
		// ── Icons used dynamically (data structures, string props) ──
		// These MUST be safelisted because UnoCSS cannot reliably extract
		// icon classes from JS objects/arrays at build time.

		// Navigation (nav.ts, search-pages.ts, AppShell, command palette)
		'i-lucide-home',
		'i-lucide-newspaper',
		'i-lucide-layout-dashboard',
		'i-lucide-layout-grid',
		'i-lucide-layout',
		'i-lucide-view',
		'i-lucide-shield',
		'i-lucide-book-open',
		'i-lucide-key',
		'i-lucide-clock',
		'i-lucide-bell',
		'i-lucide-external-link',
		'i-lucide-sun-moon',
		'i-lucide-keyboard',
		'i-lucide-settings',
		'i-lucide-table',
		'i-lucide-printer',

		// Admin sidebar
		'i-lucide-database',
		'i-lucide-bar-chart-2',
		'i-lucide-bar-chart-3',
		'i-lucide-shield-check',
		'i-lucide-users',
		'i-lucide-toggle-right',
		'i-lucide-palette',
		'i-lucide-file-text',
		'i-lucide-tag',
		'i-lucide-bot',
		'i-lucide-hard-drive',

		// App tabs
		'i-lucide-user',

		// Desk panels & activity bar
		'i-lucide-notebook-pen',
		'i-lucide-pen-tool',
		'i-lucide-pen-line',
		'i-lucide-terminal',
		'i-lucide-image',
		'i-lucide-inbox',
		'i-lucide-panel-top',
		'i-lucide-panel-left',
		'i-lucide-panel-right',
		'i-lucide-panel-bottom',
		'i-lucide-message-circle',
		'i-lucide-send',
		'i-lucide-sheet',
		'i-lucide-folder-tree',
		'i-lucide-folder',
		'i-lucide-folder-open',
		'i-lucide-file',
		'i-lucide-file-code',
		'i-lucide-file-plus',
		'i-lucide-folder-plus',
		'i-lucide-refresh-cw',
		'i-lucide-eye',

		// Dock context menu
		'i-lucide-columns-2',
		'i-lucide-rows-2',
		'i-lucide-x',

		// Explorer & editor
		'i-lucide-plus',
		'i-lucide-file-up',
		'i-lucide-upload',
		'i-lucide-save',
		'i-lucide-download',
		'i-lucide-scroll-text',
		'i-lucide-search',
		'i-lucide-pin-off',
		'i-lucide-image-plus',
		'i-lucide-link',
		'i-lucide-panels-top-left',
		'i-lucide-square-arrow-out-up-right',

		// Shell (theme toggle, dice, announcements, notifications)
		'i-lucide-sun',
		'i-lucide-moon',
		'i-lucide-dices',
		'i-lucide-lock',
		'i-lucide-unlock',
		'i-lucide-info',
		'i-lucide-alert-triangle',
		'i-lucide-alert-octagon',
		'i-lucide-mail',
		'i-lucide-at-sign',
		'i-lucide-message-square',
		'i-lucide-shield-alert',
		'i-lucide-user-plus',
		'i-lucide-check-circle',

		// Info dialog tabs
		'i-lucide-list',
		'i-lucide-code-2',

		// Menu showcases (overflow, context, selection bar, menu bar)
		'i-lucide-pencil',
		'i-lucide-copy',
		'i-lucide-archive',
		'i-lucide-trash-2',
		'i-lucide-file-edit',
		'i-lucide-layout-template',
		'i-lucide-scissors',
		'i-lucide-clipboard',
		'i-lucide-clipboard-copy',
		'i-lucide-check-square',
		'i-lucide-pin',
		'i-lucide-share-2',
		'i-lucide-git-branch',

		// Showcases registry
		'i-lucide-text-cursor-input',
		'i-lucide-activity',
		'i-lucide-languages',

		// Homepage capabilities
		'i-lucide-zap',
		'i-lucide-container',
		'i-lucide-rocket',
		'i-lucide-blocks',
		'i-lucide-sparkles',
		'i-lucide-check-check',
		'i-lucide-layers',
		'i-lucide-cloud',
		'i-lucide-paintbrush',
		'i-lucide-component',
		'i-lucide-file-check',
		'i-lucide-network',
		'i-lucide-brain',
		'i-lucide-box',

		// 3D model config
		'i-lucide-play',
		'i-lucide-sofa',

		// Domain icons (stored in DB, rendered dynamically)
		'i-lucide-code',
		'i-lucide-globe',
		'i-lucide-microscope',
		'i-lucide-briefcase',
		'i-lucide-heart',
		'i-lucide-camera',
		'i-lucide-music',
		'i-lucide-cpu',
		'i-lucide-wifi',
		'i-lucide-flag',
		'i-lucide-compass',
		'i-lucide-lightbulb',
		'i-lucide-flame',
		'i-lucide-gem',
		'i-lucide-trophy',
		'i-lucide-server',
		'i-lucide-puzzle',
		'i-lucide-wrench',
		'i-lucide-megaphone',
		'i-lucide-flask-conical',
	],
});
