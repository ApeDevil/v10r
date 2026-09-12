/**
 * One reader for both approval shapes: a gated tool's sentinel and a validated plan's.
 * The card's risk and recovery come from the tool, and the loop stops at the step that
 * asked — those two facts are what makes "one turn, one proposal" true.
 */
import { describe, expect, it } from 'vitest';
import { collectApprovalRequests, riskTierOf, stoppedAtApproval, toCardSteps } from './approval-boundary';

const target = {
	fileId: 'fil_1',
	fileType: 'markdown' as const,
	name: 'Notes',
	version: 3,
	updatedAt: '2026-09-12T08:00:00.000Z',
};

describe('collectApprovalRequests', () => {
	it("turns a gated tool's sentinel into a step with the args it was CALLED with", () => {
		const { goal, steps } = collectApprovalRequests([
			{ toolName: 'desk_read_file', input: { file_id: 'fil_1' }, output: { content: 'x' } },
			{
				toolName: 'desk_rename_file',
				input: { file_id: 'fil_1', name: 'Notes 2' },
				output: { requiresApproval: true, action: 'Rename "Notes" → "Notes 2"', target },
			},
		]);
		expect(goal).toBeNull();
		expect(steps).toEqual([
			{
				toolName: 'desk_rename_file',
				args: { file_id: 'fil_1', name: 'Notes 2' },
				rationale: 'Rename "Notes" → "Notes 2"',
				action: 'Rename "Notes" → "Notes 2"',
				target,
			},
		]);
	});

	it("takes a validated plan's steps and goal as they are", () => {
		const planSteps = [
			{
				toolName: 'desk_update_markdown',
				args: { file_id: 'fil_1', content: 'y' },
				action: 'Rewrite',
				rationale: 'r',
				target,
			},
			{ toolName: 'desk_create_markdown', args: { name: 'n', content: '' }, action: 'Create' },
		];
		const { goal, steps } = collectApprovalRequests([
			{
				toolName: 'desk_propose_plan',
				input: {},
				output: { requiresApproval: true, goal: 'tidy up', steps: planSteps },
			},
		]);
		expect(goal).toBe('tidy up');
		expect(steps).toEqual(planSteps);
	});

	it('ignores errors and plain outputs', () => {
		expect(collectApprovalRequests([{ toolName: 't', output: { error: 'nope' } }, { toolName: 'u' }]).steps).toEqual(
			[],
		);
	});
});

describe('toCardSteps / riskTierOf', () => {
	it('derives risk and recovery from the tool and strips the baseline down to what the card shows', () => {
		const cards = toCardSteps([
			{ toolName: 'desk_delete_file', args: { file_id: 'fil_1' }, action: 'Delete "Notes"', target },
			{ toolName: 'desk_create_spreadsheet', args: { name: 'n', cells: [] }, action: 'Create "n"' },
		]);
		expect(cards).toEqual([
			{
				action: 'Delete "Notes"',
				tool: 'desk_delete_file',
				risk: 'destructive',
				rationale: '',
				recovery: 'soft_delete',
				target: { fileId: 'fil_1', fileType: 'markdown', name: 'Notes', version: 3 },
			},
			{ action: 'Create "n"', tool: 'desk_create_spreadsheet', risk: 'create', rationale: '', recovery: 'none' },
		]);
		expect(riskTierOf([{ toolName: 'desk_delete_file', args: {}, action: 'd' }])).toBe('high');
		expect(riskTierOf([{ toolName: 'desk_rename_file', args: {}, action: 'r' }])).toBe('medium');
	});
});

describe('stoppedAtApproval', () => {
	const step = (toolResults: Array<{ output: unknown }>) => ({ toolResults }) as never;
	it('stops after the step that asked for approval, and only that one', () => {
		expect(stoppedAtApproval({ steps: [step([{ output: { requiresApproval: true, action: 'a' } }])] })).toBe(true);
		expect(
			stoppedAtApproval({
				steps: [step([{ output: { requiresApproval: true, action: 'a' } }]), step([{ output: { ok: 1 } }])],
			}),
		).toBe(false);
		expect(stoppedAtApproval({ steps: [step([])] })).toBe(false);
		expect(stoppedAtApproval({ steps: [] })).toBe(false);
	});
});
