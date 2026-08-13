/**
 * Recorded deskbot turn — the one-door rule as an interactive halt. The agent reads
 * the demo workspace, proposes a two-step plan, and playback STOPS at a real pending
 * PlanCard. The visitor's Approve/Reject is the next frame source: one fixture, one
 * shared prefix, two branch continuations. Nothing mutates — the workspace is fiction.
 */

import type { ProposalCardData } from '$lib/types/turn-trace';
import type { SurfaceReplay } from '../replay';

const card: ProposalCardData = {
	id: 'demo_proposal_01',
	goal: 'Reprioritize todo.md and archive the finished items into done.md',
	steps: [
		{
			action: 'Rewrite todo.md with the five open items ordered by deadline',
			tool: 'desk_update_markdown',
			risk: 'write',
			rationale: 'The list mixes finished and open work; deadlines are out of order.',
		},
		{
			action: 'Append the three finished items to done.md',
			tool: 'desk_update_markdown',
			risk: 'write',
			rationale: 'Keeps the history without cluttering the active list.',
		},
	],
	estimatedWrites: 2,
	rollback: 'Each overwrite captures a pre-image file revision — both files restore in one click.',
	riskTier: 'medium',
	status: 'pending',
};

export const deskbotPlan: SurfaceReplay = {
	version: 1,
	surface: 'deskbot',
	provenance: { recordedAt: '2026-08-13', workspace: 'demo' },
	prompt: 'Clean up my todo list — reprioritize it and archive what is finished.',
	frames: [
		{ kind: 'http', status: 200 },
		{
			kind: 'meta',
			harnessSteps: [
				{
					stepIndex: 0,
					outcomes: [
						{ tool: 'desk_list_files', status: 'ok' },
						{ tool: 'desk_read_file', status: 'ok' },
					],
					startOffsetMs: 0,
					durationMs: 380,
				},
			],
		},
		{ kind: 'text', text: 'Your list has five open items and three finished ones. ' },
		{ kind: 'text', text: 'Two files need to change, so I am proposing a plan instead of writing directly:' },
		{
			kind: 'meta',
			harnessSteps: [
				{
					stepIndex: 0,
					outcomes: [
						{ tool: 'desk_list_files', status: 'ok' },
						{ tool: 'desk_read_file', status: 'ok' },
					],
					startOffsetMs: 0,
					durationMs: 380,
				},
				{
					stepIndex: 1,
					outcomes: [{ tool: 'desk_propose_plan', status: 'ok' }],
					startOffsetMs: 1200,
					durationMs: 90,
				},
			],
			proposal: card,
		},
	],
	halt: {
		decision: 'proposal',
		branches: {
			approved: [
				{ kind: 'meta', proposal: { ...card, status: 'approved' } },
				{
					kind: 'text',
					text: ' Approved — the plan replayed through the one door (executeDeskToolCall), each step with its frozen args. ',
				},
				{ kind: 'meta', proposal: { ...card, status: 'executed' } },
				{ kind: 'text', text: 'todo.md now leads with the deadline items; done.md holds the archive.' },
				{ kind: 'finish' },
			],
			rejected: [
				{ kind: 'meta', proposal: { ...card, status: 'rejected' } },
				{
					kind: 'text',
					text: ' Understood — the proposal is rejected and nothing was written. Both files are untouched.',
				},
				{ kind: 'finish' },
			],
		},
	},
};
