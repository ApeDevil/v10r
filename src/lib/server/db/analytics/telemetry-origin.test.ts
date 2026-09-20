import { describe, expect, it } from 'vitest';
import { DEV_SCOPE_PATTERN, PROD_SCOPE_MARKER } from './telemetry-origin';

const DEV_SCOPE_RE = new RegExp(DEV_SCOPE_PATTERN);
const isProd = (target: string) => target.includes(PROD_SCOPE_MARKER);

/** Real targets sampled from 30 days of live telemetry. */
const DEV_TARGETS = [
	'nav.flex-1.overflow-y-auto.p-2.s-Xv7_7mcdkQaC.scrollbar-nav',
	'div.flyout-trigger.s-BCyWW_3SwcY2>div.flex.gap-0.items-center.relative.s-oBBzbteHOiDR',
	'#dock-interactive>p.mb-fluid-4.s-2XUM8H2CQwz0.text-fluid-base.text-muted',
	'#main-content>div.error-display.s-H2r2CV7e-etH>h1.error-heading.s-H2r2CV7e-etH',
	'span.absolute.font-bold.left-3.logo-full.logo-visible.s-KEE42-VJTpy9.text-base.text-fg',
];

const PROD_TARGETS = [
	'nav.flex-1.overflow-y-auto.p-2.scrollbar-nav.svelte-1e55qdy',
	'span.absolute.font-bold.left-3.logo-full.logo-visible.svelte-ofpdmi.text-base.text-fg',
];

const UNSCOPED_TARGETS = ['html.dark>body', 'div.absolute.h-full.opacity-50.right-0.top-0.w-[100px]'];

describe('DEV_SCOPE_PATTERN — the SQL discriminator, compiled as the same JS regex', () => {
	it.each(DEV_TARGETS)('matches a dev-build scope class: %s', (target) => {
		expect(DEV_SCOPE_RE.test(target)).toBe(true);
		expect(isProd(target)).toBe(false);
	});

	it.each(PROD_TARGETS)('does not match a prod-build target: %s', (target) => {
		expect(DEV_SCOPE_RE.test(target)).toBe(false);
		expect(isProd(target)).toBe(true);
	});

	it.each(UNSCOPED_TARGETS)('matches neither marker on an unscoped target: %s', (target) => {
		expect(DEV_SCOPE_RE.test(target)).toBe(false);
		expect(isProd(target)).toBe(false);
	});

	it('never mistakes the prod prefix for a dev scope class', () => {
		expect(DEV_SCOPE_RE.test('div.svelte-1abc2d')).toBe(false);
		expect(DEV_SCOPE_RE.test('div.svelte-abcdefghijkl')).toBe(false);
	});

	it('requires a boundary before the dev prefix, so arbitrary class text does not match', () => {
		expect(DEV_SCOPE_RE.test('div.things-abcdefghijkl')).toBe(false);
		expect(DEV_SCOPE_RE.test('div.class-with-s-inside')).toBe(false);
	});
});

describe('pattern portability', () => {
	// The same literal is interpolated into Postgres `~` in perf-queries.ts. If it
	// stops being valid JS regex the two consumers have silently diverged.
	it('DEV_SCOPE_PATTERN compiles as a JavaScript regex', () => {
		expect(() => new RegExp(DEV_SCOPE_PATTERN)).not.toThrow();
	});

	// A quote would break the SQL literal it is interpolated into.
	it('DEV_SCOPE_PATTERN contains no characters that need SQL escaping', () => {
		expect(DEV_SCOPE_PATTERN).not.toMatch(/['\\]/);
	});

	it('PROD_SCOPE_MARKER is a plain substring, not a pattern', () => {
		expect(PROD_SCOPE_MARKER).toBe('svelte-');
	});
});
