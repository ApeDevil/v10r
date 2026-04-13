/**
 * Unit tests for the governor policy layer.
 *
 * Covers:
 * - `resolveEffectivePolicy` — client floor ∩ server ceiling intersection
 * - `shouldRequirePlan` — narrow predicate for plan-before-execute
 * - `withGovernor` — arg-dependent runtime check with structured denial
 */
import { describe, expect, it } from 'vitest';
import type { DeskToolMeta } from '../tools/_types';
import type { PolicyError } from './errors';
import { resolveEffectivePolicy, shouldRequirePlan, withGovernor } from './governor';

describe('resolveEffectivePolicy', () => {
	it('passes through all requested scopes when no ceiling is set', () => {
		const policy = resolveEffectivePolicy({
			userId: 'u1',
			requestedScopes: ['desk:read', 'desk:write', 'desk:delete'],
		});
		expect(policy.scopes).toEqual(['desk:read', 'desk:write', 'desk:delete']);
	});

	it('intersects requested scopes with the server ceiling', () => {
		const policy = resolveEffectivePolicy({
			userId: 'u1',
			requestedScopes: ['desk:read', 'desk:write', 'desk:delete'],
			ceiling: { permittedScopes: ['desk:read', 'desk:write'] },
		});
		expect(policy.scopes).toEqual(['desk:read', 'desk:write']);
	});

	it('returns empty scopes when ceiling forbids everything', () => {
		const policy = resolveEffectivePolicy({
			userId: 'u1',
			requestedScopes: ['desk:delete'],
			ceiling: { permittedScopes: [] },
		});
		expect(policy.scopes).toEqual([]);
	});

	it('caps steps at 3 for read-only scopes', () => {
		const policy = resolveEffectivePolicy({ userId: 'u1', requestedScopes: ['desk:read'] });
		expect(policy.maxStepsPerTurn).toBe(3);
	});

	it('caps steps at 5 when any mutating scope is present', () => {
		const policy = resolveEffectivePolicy({ userId: 'u1', requestedScopes: ['desk:read', 'desk:write'] });
		expect(policy.maxStepsPerTurn).toBe(5);
	});

	it('propagates daily tool budget from ceiling', () => {
		const policy = resolveEffectivePolicy({
			userId: 'u1',
			requestedScopes: ['desk:read'],
			ceiling: { permittedScopes: ['desk:read'], dailyToolBudget: 200 },
		});
		expect(policy.dailyToolBudget).toBe(200);
	});
});

describe('shouldRequirePlan', () => {
	it('fires when all three conditions hold', () => {
		expect(
			shouldRequirePlan({
				lastUserMessage: 'delete all my scratch files and purge the backups',
				toolRisks: ['read', 'destructive', 'destructive'],
				panelContextCount: 3,
			}),
		).toBe(true);
	});

	it('does not fire without destructive intent in the user message', () => {
		expect(
			shouldRequirePlan({
				lastUserMessage: 'summarize my notes',
				toolRisks: ['destructive', 'destructive'],
				panelContextCount: 3,
			}),
		).toBe(false);
	});

	it('does not fire when fewer than two destructive tools are registered', () => {
		expect(
			shouldRequirePlan({
				lastUserMessage: 'delete this',
				toolRisks: ['destructive'],
				panelContextCount: 3,
			}),
		).toBe(false);
	});

	it('does not fire for single-target operations (panelContextCount < 2)', () => {
		expect(
			shouldRequirePlan({
				lastUserMessage: 'delete this file',
				toolRisks: ['destructive', 'destructive'],
				panelContextCount: 1,
			}),
		).toBe(false);
	});

	it('recognises multiple destructive synonyms', () => {
		for (const verb of ['delete', 'remove', 'drop', 'trash', 'purge', 'clear', 'wipe', 'erase', 'destroy']) {
			expect(
				shouldRequirePlan({
					lastUserMessage: `please ${verb} everything`,
					toolRisks: ['destructive', 'destructive'],
					panelContextCount: 2,
				}),
			).toBe(true);
		}
	});
});

describe('withGovernor', () => {
	const meta: DeskToolMeta = { risk: 'write', scope: 'desk:write' };

	it('passes through when the check returns null', async () => {
		const execute = async (input: { x: number }) => ({ ok: true, value: input.x });
		const wrapped = withGovernor('tool', meta, () => null, execute);
		const result = await wrapped({ x: 42 }, {});
		expect(result).toEqual({ ok: true, value: 42 });
	});

	it('returns the model-view error envelope when the check denies', async () => {
		const denial: PolicyError = {
			code: 'policy_denied',
			policyName: 'test.rule',
			reason: 'testing',
			humanMessage: 'Nope, not this time.',
			retryable: false,
		};
		const execute = async () => {
			throw new Error('should not be called');
		};
		const wrapped = withGovernor('tool', meta, () => denial, execute);
		const result = (await wrapped({}, {})) as { error: { code: string; hint: string; retryable: boolean } };
		expect(result.error.code).toBe('policy_denied');
		expect(result.error.hint).toBe('Nope, not this time.');
		expect(result.error.retryable).toBe(false);
		// Must NOT include policy rule names or evidence (leak-minimization).
		expect(result.error).not.toHaveProperty('policyName');
		expect(result.error).not.toHaveProperty('evidence');
	});
});
