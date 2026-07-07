import { describe, expect, it } from 'vitest';
import { ELEVATION_CEILING, elevationAttr, resolveLevel } from './elevation';

// Pure level algebra only — useSurface/getParentLevel touch Svelte context (getContext),
// so they are exercised E2E in the showcase, not here (see project memory: vitest node env
// runs the SSR build; component context isn't available in a bare unit test).

describe('resolveLevel', () => {
	it('is pure relative: parent + 1', () => {
		expect(resolveLevel({}, 0)).toBe(1);
		expect(resolveLevel({}, 1)).toBe(2);
		expect(resolveLevel({}, 3)).toBe(4);
	});

	it('keeps counting past the ceiling (unclamped depth)', () => {
		expect(resolveLevel({}, 4)).toBe(5);
		expect(resolveLevel({}, 6)).toBe(7);
	});

	it('honours an explicit level override, ignoring the parent', () => {
		expect(resolveLevel({ level: 0 }, 3)).toBe(0);
		expect(resolveLevel({ level: 2 }, 9)).toBe(2);
	});
});

describe('elevationAttr', () => {
	it('clamps to the token ceiling', () => {
		expect(elevationAttr(1)).toBe('1');
		expect(elevationAttr(4)).toBe('4');
		expect(elevationAttr(7)).toBe('4'); // hardcoded, NOT String(CEILING) — must fail if the ceiling drifts
	});

	it('omits the attribute for the page plane (level 0 or below)', () => {
		expect(elevationAttr(0)).toBeUndefined();
		expect(elevationAttr(-1)).toBeUndefined();
	});
});

describe('ELEVATION_CEILING — regression guard', () => {
	it('is 4, hardcoded so a silent drift fails the suite', () => {
		expect(ELEVATION_CEILING).toBe(4);
		expect(elevationAttr(4)).toBe('4'); // adjacent rungs collide at the ceiling
		expect(elevationAttr(5)).toBe('4');
	});
});

describe('resolveLevel — override edge cases', () => {
	it('passes a negative override straight through (→ no attribute)', () => {
		expect(resolveLevel({ level: -3 }, 2)).toBe(-3);
		expect(elevationAttr(resolveLevel({ level: -3 }, 2))).toBeUndefined();
	});

	it('treats explicit level:0 as a reset root, not parent + 1', () => {
		expect(resolveLevel({ level: 0 }, 9)).toBe(0);
		expect(elevationAttr(0)).toBeUndefined();
	});

	it('treats level:undefined as nullish — identical to omitted', () => {
		expect(resolveLevel({ level: undefined }, 2)).toBe(resolveLevel({}, 2));
	});
});

describe('ceiling saturation chain — the depth-vs-display contract', () => {
	// Mirrors what useSurface seeds: the UNCLAMPED depth is stored so a child does an honest
	// parent + 1, while each element's DISPLAY clamps independently. Two surfaces stacked past
	// the ceiling both display "4" yet seed distinct depths — z-order/rim carry separation beyond.
	it('two surfaces past E4 both display 4 but seed distinct unclamped depths', () => {
		const parentSeed = resolveLevel({}, 4); // an E4 surface seeds 5 to its children
		const childSeed = resolveLevel({}, parentSeed); // child reads 5, seeds 6
		expect(parentSeed).toBe(5);
		expect(childSeed).toBe(6);
		expect(elevationAttr(parentSeed)).toBe('4');
		expect(elevationAttr(childSeed)).toBe('4');
		expect(parentSeed).not.toBe(childSeed); // seeding is NOT clamped
	});
});
