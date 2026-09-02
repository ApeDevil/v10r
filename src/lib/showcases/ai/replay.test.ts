/**
 * Reducer + fixture guards. The two properties that make the scrubber safe:
 * idempotence (same inputs, same state — always) and monotone-prefix
 * (state(n) is exactly the reduction of the first n frames, so seeking backwards
 * can never leave residue).
 */

import { describe, expect, it } from 'vitest';
import { deskbotToolMeta } from '$lib/server/ai/tools';
import { TOOL_MANIFEST } from '$lib/types/ai-tools';
import { chatbotGrounded } from './fixtures/chatbot-grounded';
import { deskbotPlan } from './fixtures/deskbot-plan';
import { deskbotSentinel } from './fixtures/deskbot-sentinel';
import { type HaltDecision, reduceTurn, replayTimeline, type SurfaceReplay } from './replay';

const FIXTURES: SurfaceReplay[] = [chatbotGrounded, deskbotPlan, deskbotSentinel];

describe('reduceTurn — purity properties', () => {
	it('is idempotent at every cursor', () => {
		for (const fixture of FIXTURES) {
			const len = replayTimeline(fixture).length;
			for (let n = 0; n <= len; n++) {
				expect(reduceTurn(fixture, n)).toEqual(reduceTurn(fixture, n));
			}
		}
	});

	it('is monotone-prefix: state(n) ≡ reduction of the first n frames', () => {
		for (const fixture of FIXTURES) {
			const frames = fixture.frames;
			for (let n = 0; n <= frames.length; n++) {
				const sliced: SurfaceReplay = { ...fixture, frames: frames.slice(0, n), halt: undefined };
				// Compare everything except halt-dependent outcome semantics.
				const full = reduceTurn({ ...fixture, halt: undefined }, n);
				const prefix = reduceTurn(sliced, n);
				expect(prefix).toEqual(full);
			}
		}
	});

	it('clamps out-of-range cursors instead of throwing', () => {
		expect(() => reduceTurn(chatbotGrounded, -5)).not.toThrow();
		expect(reduceTurn(chatbotGrounded, 10_000)).toEqual(
			reduceTurn(chatbotGrounded, replayTimeline(chatbotGrounded).length),
		);
	});

	it('coalesces text deltas — seek to N renders the concatenation, no residue', () => {
		const end = reduceTurn(chatbotGrounded, replayTimeline(chatbotGrounded).length);
		const again = reduceTurn(chatbotGrounded, 3);
		expect(again.answerText).toBe('');
		expect(end.answerText).toContain('leak-gate');
	});
});

describe('reduceTurn — chatbot profile', () => {
	it('seeds the llmwiki profile pending at cursor 0', () => {
		const state = reduceTurn(chatbotGrounded, 0);
		expect(state.steps.length).toBeGreaterThan(0);
		expect(state.steps.every((s) => s.status === 'pending')).toBe(true);
		expect(state.outcome).toBeNull();
	});

	it('ends ok with all seeded steps done and guard passed', () => {
		const state = reduceTurn(chatbotGrounded, replayTimeline(chatbotGrounded).length);
		expect(state.outcome?.kind).toBe('ok');
		expect(state.guard.every((g) => g.status === 'done')).toBe(true);
		expect(state.steps.filter((s) => s.status !== 'done')).toEqual([]);
		expect(state.layers.persist).toBe('done');
		expect(state.prompt?.estimated).toBe(true);
	});
});

describe('reduceTurn — deskbot halt + branches', () => {
	const prefixLen = deskbotPlan.frames.length;

	it('halts awaiting the human decision at the end of the shared prefix', () => {
		const state = reduceTurn(deskbotPlan, prefixLen);
		expect(state.outcome?.kind).toBe('awaiting_decision');
		expect(state.proposal?.card.status).toBe('pending');
		expect(state.layers.gate).toBe('active');
	});

	it.each(['approved', 'rejected'] as HaltDecision[])('continues down the %s branch', (decision) => {
		const len = replayTimeline(deskbotPlan, decision).length;
		const state = reduceTurn(deskbotPlan, len, decision);
		expect(state.outcome?.kind).toBe('ok');
		expect(state.proposal?.decision).toBe(decision);
		expect(state.proposal?.card.status).toBe(decision === 'approved' ? 'executed' : 'rejected');
	});

	it('changing the decision mid-scrub leaves no residue (rebuild-from-seed)', () => {
		const lenApproved = replayTimeline(deskbotPlan, 'approved').length;
		reduceTurn(deskbotPlan, lenApproved, 'approved');
		const backToReject = reduceTurn(deskbotPlan, replayTimeline(deskbotPlan, 'rejected').length, 'rejected');
		expect(backToReject.proposal?.card.status).toBe('rejected');
		expect(backToReject.answerText).not.toContain('replayed');
	});
});

describe('fixture validity — pinned to the live manifest', () => {
	function harnessToolNames(replay: SurfaceReplay): string[] {
		const names: string[] = [];
		for (const frame of [
			...replay.frames,
			...(replay.halt ? [...replay.halt.branches.approved, ...replay.halt.branches.rejected] : []),
		]) {
			if (frame.kind !== 'meta') continue;
			for (const step of frame.harnessSteps ?? []) for (const o of step.outcomes) names.push(o.tool);
			for (const s of frame.proposal?.steps ?? []) names.push(s.tool);
		}
		return names;
	}

	it('every deskbot fixture tool exists in deskbotToolMeta', () => {
		for (const fixture of [deskbotPlan, deskbotSentinel]) {
			for (const name of harnessToolNames(fixture)) {
				expect(deskbotToolMeta[name], `${fixture.prompt}: ${name}`).toBeDefined();
			}
		}
	});

	it('requires_approval outcomes name only write/destructive tools', () => {
		for (const fixture of [deskbotPlan, deskbotSentinel]) {
			for (const frame of replayTimeline(fixture, 'approved')) {
				if (frame.kind !== 'meta') continue;
				for (const step of frame.harnessSteps ?? []) {
					for (const outcome of step.outcomes) {
						if (outcome.status !== 'requires_approval') continue;
						const entry = TOOL_MANIFEST.find((d) => d.name === outcome.tool);
						expect(['write', 'destructive']).toContain(entry?.risk);
					}
				}
			}
		}
	});

	it('halt branches restate the card in a terminal state', () => {
		expect(deskbotPlan.halt).toBeDefined();
		const lastApproved = [...(deskbotPlan.halt?.branches.approved ?? [])].reverse().find((f) => f.kind === 'meta');
		const lastRejected = [...(deskbotPlan.halt?.branches.rejected ?? [])].reverse().find((f) => f.kind === 'meta');
		expect(lastApproved?.kind === 'meta' && lastApproved.proposal?.status).toBe('executed');
		expect(lastRejected?.kind === 'meta' && lastRejected.proposal?.status).toBe('rejected');
	});
});
