import { describe, expect, it } from 'vitest';
import { computeKeyboardState, visualViewportWatcher } from './visual-viewport.svelte';

describe('computeKeyboardState (hysteresis)', () => {
	it('stays closed below the open threshold (browser-chrome artifacts)', () => {
		// iOS bottom toolbar ~44-56px, iOS 26 residual bug ~24px
		expect(computeKeyboardState(56, false)).toEqual({ inset: 0, open: false });
		expect(computeKeyboardState(24, false)).toEqual({ inset: 0, open: false });
		expect(computeKeyboardState(150, false)).toEqual({ inset: 0, open: false });
	});

	it('opens above 150px (any real soft keyboard)', () => {
		expect(computeKeyboardState(280, false)).toEqual({ inset: 280, open: true });
	});

	it('stays open between the thresholds once open (no flapping)', () => {
		expect(computeKeyboardState(120, true)).toEqual({ inset: 120, open: true });
	});

	it('closes below 100px', () => {
		expect(computeKeyboardState(80, true)).toEqual({ inset: 0, open: false });
		expect(computeKeyboardState(-10, true)).toEqual({ inset: 0, open: false });
	});

	it('rounds fractional insets', () => {
		expect(computeKeyboardState(280.6, false)).toEqual({ inset: 281, open: true });
	});
});

describe('watcher (node env)', () => {
	it('is dormant without a browser: attach is a no-op reporting closed', () => {
		const detach = visualViewportWatcher.attach();
		expect(visualViewportWatcher.keyboardOpen).toBe(false);
		expect(visualViewportWatcher.keyboardInset).toBe(0);
		detach();
	});
});
