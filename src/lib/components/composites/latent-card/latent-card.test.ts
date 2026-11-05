import { describe, expect, it } from 'vitest';
import { isSurfaceTap, nextPinned } from './latent-card';

describe('nextPinned', () => {
	it('toggles the pin on a surface tap', () => {
		expect(nextPinned(false, 'surface-tap')).toBe(true);
		expect(nextPinned(true, 'surface-tap')).toBe(false);
	});

	it('releases the pin on an outside tap or Escape, and never sets it', () => {
		for (const signal of ['outside-tap', 'escape'] as const) {
			expect(nextPinned(true, signal)).toBe(false);
			expect(nextPinned(false, signal)).toBe(false);
		}
	});
});

describe('isSurfaceTap', () => {
	it('counts touch and pen taps on the surface', () => {
		expect(isSurfaceTap('touch', false)).toBe(true);
		expect(isSurfaceTap('pen', false)).toBe(true);
	});

	it('ignores the mouse, which engages through hover instead', () => {
		expect(isSurfaceTap('mouse', false)).toBe(false);
	});

	it('leaves a tap on a control to the control', () => {
		expect(isSurfaceTap('touch', true)).toBe(false);
	});
});
