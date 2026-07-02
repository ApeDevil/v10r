/**
 * Unit tests for the governor policy layer.
 *
 * `shouldRequirePlan` — WIDENED: fires whenever a mutating scope is granted AND
 * the turn shows destructive/overwrite intent (single-target included). The old
 * three-condition AND (>=2 destructive tools + >=2 targets) is gone — it let every
 * single-target destructive op skip the gate.
 *
 * `requiresApproval` — the per-tool hard-gate predicate: write/destructive tools
 * must go through a human-approved proposal; read/create do not.
 */
import { describe, expect, it } from 'vitest';
import { requiresApproval, shouldRequirePlan } from './governor';

describe('shouldRequirePlan', () => {
	it('fires for a single-target destructive op (mutating scope + destructive intent)', () => {
		expect(shouldRequirePlan({ mutatingScopeGranted: true, destructiveIntent: true })).toBe(true);
	});

	it('does not fire without destructive intent', () => {
		expect(shouldRequirePlan({ mutatingScopeGranted: true, destructiveIntent: false })).toBe(false);
	});

	it('does not fire without a mutating scope (chatbot / read-only turns)', () => {
		expect(shouldRequirePlan({ mutatingScopeGranted: false, destructiveIntent: true })).toBe(false);
	});
});

describe('requiresApproval', () => {
	it('gates write and destructive tools', () => {
		expect(requiresApproval('write')).toBe(true);
		expect(requiresApproval('destructive')).toBe(true);
	});

	it('does not gate read or create tools', () => {
		expect(requiresApproval('read')).toBe(false);
		expect(requiresApproval('create')).toBe(false);
	});
});
