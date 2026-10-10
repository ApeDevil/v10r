/**
 * The fallback faces are derived data: generated from the installed fontsource files by
 * scripts/fonts/build-fallback-faces.ts. Two ways they rot silently — a font update
 * changes metrics nobody regenerates, or a family is added without a fallback face (its
 * swap shifts layout again) — and both are checked here.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAMILIES, OUT, render, SERIF_DISPLAY_WITHOUT_FALLBACK } from '../../../scripts/fonts/build-fallback-faces';
import { TYPOGRAPHY_REGISTRY } from './random/typography-registry';

describe('font fallback faces', () => {
	it('match the installed fonts (regenerate with scripts/fonts/build-fallback-faces.ts)', () => {
		expect(readFileSync(OUT, 'utf8')).toBe(render());
	});

	it('cover every fontsource family the root layout loads, bar the measured exclusions', () => {
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		const loaded = [...layout.matchAll(/import '@fontsource-variable\/([\w-]+)';/g)].map((m) => m[1]).sort();
		expect([...FAMILIES.map((f) => f.file), ...SERIF_DISPLAY_WITHOUT_FALLBACK].sort()).toEqual(loaded);
	});

	it('sit directly after their web font in every stack, and only where a face exists', () => {
		const withFace = new Set(FAMILIES.map((f) => f.family.replace(' Variable', '')));
		const stacks = [
			...TYPOGRAPHY_REGISTRY.flatMap((set) => [set.heading, set.body, set.mono]),
			...[...readFileSync('src/app.css', 'utf8').matchAll(/--font-(?:heading|body|mono):\s*([^;]+);/g)].map(
				(m) => m[1],
			),
		];
		for (const stack of stacks) {
			const family = /^"([^"]+) Variable"/.exec(stack)?.[1];
			if (!family) continue;
			if (withFace.has(family))
				expect(stack, stack).toContain(`"${family} Variable", "${family}", "${family} Fallback"`);
			else expect(stack, stack).not.toContain('Fallback"');
		}
	});
});
