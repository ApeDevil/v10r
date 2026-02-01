import { defineConfig, presetUno, presetIcons } from 'unocss';
import transformerDirectives from '@unocss/transformer-directives';
import {
	breakpoints,
	containers,
	fontSize,
	spacing,
	colors,
	zIndex,
	duration,
} from './src/lib/styles/tokens';

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

	theme: {
		breakpoints,
		containers,
		fontSize,
		spacing,
		colors,
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

	// Safelist commonly used dynamic classes
	safelist: [
		...Object.keys(fontSize).map((k) => `text-${k}`),
		...Object.keys(spacing).flatMap((k) => [`p-${k}`, `m-${k}`, `gap-${k}`]),
	],
});
