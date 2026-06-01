/**
 * Unit tests for the governor policy layer.
 *
 * Covers `shouldRequirePlan` — the pure plan-before-execute predicate. The
 * gate is a three-condition AND: destructive intent + >=2 destructive tools +
 * >=2 target entities. Cases probe each condition and the >= thresholds.
 */
import { describe, expect, it } from 'vitest';
import { shouldRequirePlan } from './governor';

describe('shouldRequirePlan', () => {
	it('fires when all three conditions hold', () => {
		expect(shouldRequirePlan({ destructiveIntent: true, destructiveToolCount: 3, targetEntityCount: 4 })).toBe(true);
	});

	it('fires at the exact >= thresholds (2 destructive tools, 2 targets)', () => {
		expect(shouldRequirePlan({ destructiveIntent: true, destructiveToolCount: 2, targetEntityCount: 2 })).toBe(true);
	});

	it('does not fire without destructive intent', () => {
		expect(shouldRequirePlan({ destructiveIntent: false, destructiveToolCount: 3, targetEntityCount: 4 })).toBe(false);
	});

	it('does not fire with fewer than two destructive tools', () => {
		expect(shouldRequirePlan({ destructiveIntent: true, destructiveToolCount: 1, targetEntityCount: 4 })).toBe(false);
	});

	it('does not fire for single-target operations', () => {
		expect(shouldRequirePlan({ destructiveIntent: true, destructiveToolCount: 3, targetEntityCount: 1 })).toBe(false);
	});
});
