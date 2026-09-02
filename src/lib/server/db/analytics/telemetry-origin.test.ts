import { describe, expect, it } from 'vitest';
import { classifyOrigin, classifyTarget, DEV_SCOPE_PATTERN, PROD_SCOPE_MARKER } from './telemetry-origin';

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

describe('classifyTarget', () => {
	it.each(DEV_TARGETS)('classifies a dev scope class: %s', (target) => {
		expect(classifyTarget(target)).toBe('dev');
	});

	it.each(PROD_TARGETS)('classifies a prod scope class: %s', (target) => {
		expect(classifyTarget(target)).toBe('prod');
	});

	it.each(UNSCOPED_TARGETS)('returns null when no scope class is present: %s', (target) => {
		expect(classifyTarget(target)).toBeNull();
	});

	it('returns null for absent input rather than throwing', () => {
		expect(classifyTarget(null)).toBeNull();
		expect(classifyTarget(undefined)).toBeNull();
		expect(classifyTarget('')).toBeNull();
	});

	// The whole discriminator collapses if the dev pattern also matches `svelte-`,
	// since every prod sample would then be filtered out as dev and the observatory
	// would show an empty prod lane on a perfectly healthy deployment.
	it('never mistakes the prod prefix for a dev scope class', () => {
		expect(classifyTarget('div.svelte-1abc2d')).toBe('prod');
		expect(classifyTarget('div.svelte-abcdefghijkl')).toBe('prod');
	});

	it('requires a boundary before the dev prefix, so arbitrary class text does not match', () => {
		expect(classifyTarget('div.things-abcdefghijkl')).toBeNull();
		expect(classifyTarget('div.class-with-s-inside')).toBeNull();
	});
});

describe('classifyOrigin', () => {
	it('reports prod when only prod markers appear', () => {
		expect(classifyOrigin(PROD_TARGETS)).toBe('prod');
	});

	it('reports dev when only dev markers appear', () => {
		expect(classifyOrigin(DEV_TARGETS)).toBe('dev');
	});

	// Conservative direction: a dev marker proves a developer's browser was
	// involved; a prod marker only proves one component came from a prod build.
	it('reports dev when a session mixes both', () => {
		expect(classifyOrigin([...PROD_TARGETS, ...DEV_TARGETS])).toBe('dev');
		expect(classifyOrigin([...DEV_TARGETS, ...PROD_TARGETS])).toBe('dev');
	});

	it('reports unknown when nothing is classifiable, rather than assuming prod', () => {
		expect(classifyOrigin(UNSCOPED_TARGETS)).toBe('unknown');
		expect(classifyOrigin([])).toBe('unknown');
		expect(classifyOrigin([null, undefined])).toBe('unknown');
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
