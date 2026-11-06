import { describe, expect, it } from 'vitest';
import { isSurfaceTap, nextPinned, pickCenteredCard } from './latent-card';

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

describe('pickCenteredCard', () => {
	const viewport = 800;

	it('picks the card whose center is nearest the viewport center line', () => {
		const spans = [
			{ top: -200, bottom: 100 },
			{ top: 150, bottom: 450 },
			{ top: 500, bottom: 800 },
		];
		expect(pickCenteredCard(spans, viewport)).toBe(1);
	});

	it('moves the spotlight as the list scrolls', () => {
		const scrolled = [
			{ top: -500, bottom: -200 },
			{ top: -150, bottom: 150 },
			{ top: 200, bottom: 500 },
		];
		expect(pickCenteredCard(scrolled, viewport)).toBe(2);
	});

	it('ignores a card that only peeks in at an edge', () => {
		expect(pickCenteredCard([{ top: 700, bottom: 1100 }], viewport)).toBe(-1);
		expect(pickCenteredCard([{ top: -400, bottom: 100 }], viewport)).toBe(-1);
	});

	it('returns -1 for no cards', () => {
		expect(pickCenteredCard([], viewport)).toBe(-1);
	});
});
