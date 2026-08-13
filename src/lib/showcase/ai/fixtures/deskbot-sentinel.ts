/**
 * Recorded deskbot turn — the tool-layer approval gate firing WITHOUT a plan. The
 * model reaches for a direct write; `desk_update_markdown` returns the
 * `requiresApproval` sentinel instead of mutating, and the turn ends with a pending
 * proposal. Different claim from `deskbot-plan`: here the TOOL refused, before any
 * human was asked — even a single-target write cannot run in-loop.
 */

import type { SurfaceReplay } from '../replay';

export const deskbotSentinel: SurfaceReplay = {
	version: 1,
	surface: 'deskbot',
	provenance: { recordedAt: '2026-08-13', workspace: 'demo' },
	prompt: 'Fix the typo in notes.md — change "recieve" to "receive".',
	frames: [
		{ kind: 'http', status: 200 },
		{
			kind: 'meta',
			harnessSteps: [
				{
					stepIndex: 0,
					outcomes: [{ tool: 'desk_read_file', status: 'ok' }],
					startOffsetMs: 0,
					durationMs: 210,
				},
			],
		},
		{ kind: 'text', text: 'Found it — one occurrence on the third line. Writing the fix… ' },
		{
			kind: 'meta',
			harnessSteps: [
				{
					stepIndex: 0,
					outcomes: [{ tool: 'desk_read_file', status: 'ok' }],
					startOffsetMs: 0,
					durationMs: 210,
				},
				{
					stepIndex: 1,
					outcomes: [{ tool: 'desk_update_markdown', status: 'requires_approval' }],
					startOffsetMs: 900,
					durationMs: 40,
				},
			],
			proposal: {
				id: 'demo_proposal_02',
				goal: 'Correct "recieve" to "receive" in notes.md',
				steps: [
					{
						action: 'Replace the misspelling on line 3 of notes.md',
						tool: 'desk_update_markdown',
						risk: 'write',
						rationale: 'Single-word correction; content otherwise unchanged.',
					},
				],
				estimatedWrites: 1,
				rollback: 'The overwrite captures a pre-image revision of notes.md.',
				riskTier: 'low',
				status: 'pending',
			},
		},
		{
			kind: 'text',
			text: 'The write did not run — desk_update_markdown returned a requiresApproval sentinel, so even this one-word fix waits for your approval. Nothing in your workspace changed.',
		},
		{ kind: 'finish' },
	],
};
