/**
 * The read-side resolution of a turn's proposal: by id, bound to the turn's own message,
 * with the card's steps derived from the tool and the receipts in execution order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnTrace } from '$lib/types/turn-trace';

const mocks = vi.hoisted(() => ({
	getProposal: vi.fn(),
	listProposalSteps: vi.fn(),
}));

vi.mock('$lib/server/db/ai/proposals', () => ({
	getProposal: mocks.getProposal,
	listProposalSteps: mocks.listProposalSteps,
}));
vi.mock('$lib/server/db', () => ({ db: {} }));

const { resolveTurnProposal } = await import('./turn-proposal');

const trace = {
	messageId: 'msg_turn',
	conversationId: 'cnv_1',
	proposalId: 'prp_1',
} as unknown as TurnTrace;

const row = {
	id: 'prp_1',
	messageId: 'msg_turn',
	conversationId: 'cnv_1',
	status: 'executed',
	riskTier: 'medium',
	rationale: 'Reprioritize todo.md',
	payload: [
		{
			toolName: 'desk_update_markdown',
			args: { fileId: 'fil_1', content: '# Todo' },
			action: 'Rewrite todo.md',
			rationale: 'Deadlines are out of order.',
			target: {
				fileId: 'fil_1',
				fileType: 'markdown',
				name: 'todo.md',
				version: 4,
				updatedAt: '2026-09-12T10:00:00.000Z',
			},
		},
	],
	grantedScopes: ['desk:read', 'desk:write'],
	failureMessage: null,
	expiresAt: new Date('2026-09-12T10:15:00.000Z'),
	approvedAt: new Date('2026-09-12T10:01:00.000Z'),
	executedAt: new Date('2026-09-12T10:01:02.000Z'),
};

describe('resolveTurnProposal', () => {
	beforeEach(() => {
		mocks.getProposal.mockReset();
		mocks.listProposalSteps.mockReset();
	});

	it('leaves a turn without a proposal untouched', async () => {
		const bare = { ...trace, proposalId: null };
		expect(await resolveTurnProposal(bare)).toBe(bare);
		expect(mocks.getProposal).not.toHaveBeenCalled();
	});

	it('resolves the card, the frozen scopes and the receipts by id', async () => {
		mocks.getProposal.mockResolvedValueOnce(row);
		mocks.listProposalSteps.mockResolvedValueOnce([
			{
				proposalId: 'prp_1',
				stepIndex: 0,
				toolName: 'desk_update_markdown',
				kind: 'ok',
				output: { version: 5 },
				errorMessage: null,
			},
		]);
		const resolved = await resolveTurnProposal(trace);
		expect(resolved.proposal).toEqual({
			id: 'prp_1',
			status: 'executed',
			riskTier: 'medium',
			goal: 'Reprioritize todo.md',
			steps: [
				{
					action: 'Rewrite todo.md',
					tool: 'desk_update_markdown',
					risk: 'write',
					rationale: 'Deadlines are out of order.',
					recovery: 'revision',
					retentionDays: 90,
					target: { fileId: 'fil_1', fileType: 'markdown', name: 'todo.md', version: 4 },
				},
			],
			grantedScopes: ['desk:read', 'desk:write'],
			receipts: [
				{ stepIndex: 0, toolName: 'desk_update_markdown', kind: 'ok', output: { version: 5 }, errorMessage: null },
			],
			failureMessage: null,
			expiresAt: '2026-09-12T10:15:00.000Z',
			approvedAt: '2026-09-12T10:01:00.000Z',
			executedAt: '2026-09-12T10:01:02.000Z',
		});
		// The args the replay runs never cross to the reader.
		expect(JSON.stringify(resolved.proposal)).not.toContain('# Todo');
	});

	it('does not attach a proposal that names another message', async () => {
		mocks.getProposal.mockResolvedValueOnce({ ...row, messageId: 'msg_other' });
		const resolved = await resolveTurnProposal(trace);
		expect(resolved.proposal).toBeUndefined();
		expect(mocks.listProposalSteps).not.toHaveBeenCalled();
	});

	it('does not attach a proposal that is gone', async () => {
		mocks.getProposal.mockResolvedValueOnce(null);
		expect((await resolveTurnProposal(trace)).proposal).toBeUndefined();
	});
});
