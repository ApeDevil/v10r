/**
 * The desk-plan rules: `shouldRequirePlan` — WIDENED: fires whenever a mutating scope is
 * granted AND the turn shows destructive/overwrite intent (single-target included); the old
 * three-condition AND let every single-target destructive op skip the gate. And what the
 * `<planning>` guide tells the model.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const { hasDestructiveIntent, hasMutatingScope, PLANNING_GUIDE, shouldRequirePlan } = await import('./desk-plan');

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

describe('hasDestructiveIntent', () => {
	it('reads overwrite, bulk and delete phrasing, not a plain question', () => {
		expect(hasDestructiveIntent('Delete the budget sheet')).toBe(true);
		expect(hasDestructiveIntent('Replace all the totals')).toBe(true);
		expect(hasDestructiveIntent('What is in the budget sheet?')).toBe(false);
	});
});

describe('hasMutatingScope', () => {
	it('counts write, create and delete — never read or ask', () => {
		expect(hasMutatingScope(['desk:read', 'desk:ask'])).toBe(false);
		expect(hasMutatingScope([])).toBe(false);
		expect(hasMutatingScope(['desk:read', 'desk:write'])).toBe(true);
		expect(hasMutatingScope(['desk:create'])).toBe(true);
		expect(hasMutatingScope(['desk:delete'])).toBe(true);
	});
});

describe('PLANNING_GUIDE', () => {
	it('wraps in <planning> tags and references the desk_propose_plan tool', () => {
		expect(PLANNING_GUIDE.startsWith('<planning>')).toBe(true);
		expect(PLANNING_GUIDE.endsWith('</planning>')).toBe(true);
		expect(PLANNING_GUIDE).toContain('desk_propose_plan');
	});

	it('excludes single-tool reads and creates from the planning requirement', () => {
		expect(PLANNING_GUIDE).toContain('Do NOT call desk_propose_plan for');
		expect(PLANNING_GUIDE).toContain('desk_list_files');
		expect(PLANNING_GUIDE).toContain('desk_create_markdown');
	});

	it('prevents re-planning after plan approval', () => {
		expect(PLANNING_GUIDE).toContain('do not re-plan');
	});
});
