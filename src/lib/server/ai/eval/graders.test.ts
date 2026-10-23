import { describe, expect, it } from 'vitest';
import { chatbotGrounded } from '$lib/showcases/ai/fixtures/chatbot-grounded';
import { deskbotPlan } from '$lib/showcases/ai/fixtures/deskbot-plan';
import { deskbotSentinel } from '$lib/showcases/ai/fixtures/deskbot-sentinel';
import type { EvalCase, Expectation } from './eval-case';
import { type GradedTurn, grade } from './graders';
import { checkFloor, scoreCase, scorecard } from './scorecard';

/** A synthetic turn, for the failing side of each grader. */
function turn(over: Partial<GradedTurn['trace']> & { answer?: string } = {}): GradedTurn {
	const { answer = '', ...trace } = over;
	return { answer, trace: { outcome: 'ok', citations: [], toolExecutions: [], proposalId: null, ...trace } };
}

const pass = (e: Expectation, t: GradedTurn) => grade(e, t).pass;

describe('graders over the committed turn fixtures', () => {
	it('the grounded chatbot turn cites only what it surfaced, via the catalog', () => {
		expect(pass({ kind: 'cites-only-surfaced' }, chatbotGrounded)).toBe(true);
		expect(pass({ kind: 'calls-tool', tool: 'search_catalog' }, chatbotGrounded)).toBe(true);
		expect(pass({ kind: 'cites', path: '/docs/blueprint/security' }, chatbotGrounded)).toBe(true);
		expect(pass({ kind: 'outcome', is: 'ok' }, chatbotGrounded)).toBe(true);
		expect(pass({ kind: 'no-citations' }, chatbotGrounded)).toBe(false);
	});

	it('both deskbot turns stop on a proposal and never ran a delete', () => {
		for (const t of [deskbotPlan, deskbotSentinel]) {
			expect(pass({ kind: 'stops-at-approval' }, t)).toBe(true);
			expect(pass({ kind: 'never-calls', tools: ['desk_delete_file'] }, t)).toBe(true);
		}
		expect(pass({ kind: 'calls-any-tool', tools: ['desk_propose_plan', 'desk_edit_markdown'] }, deskbotPlan)).toBe(
			true,
		);
	});
});

describe('each grader fails on the fact it guards', () => {
	it('flags a recalled, unsurfaced path', () => {
		const t = turn({ citations: [{ itemId: '/docs/x', source: 'catalog', match: 'unsurfaced', path: '/docs/x' }] });
		expect(grade({ kind: 'cites-only-surfaced' }, t)).toEqual({ pass: false, detail: 'unsurfaced: /docs/x' });
	});

	it('matches a cited path exactly or as a prefix segment, never as a string prefix', () => {
		const t = turn({ citations: [{ itemId: 'i', source: 'catalog', match: 'path', path: '/showcases/forms-extra' }] });
		expect(pass({ kind: 'cites', path: '/showcases/forms' }, t)).toBe(false);
		const u = turn({ citations: [{ itemId: 'i', source: 'catalog', match: 'path', path: '/showcases/forms/basics' }] });
		expect(pass({ kind: 'cites', path: '/showcases/forms' }, u)).toBe(true);
	});

	it('a recalled path is not a grounded citation, and an errored call did not run the tool', () => {
		const recalled = turn({
			citations: [{ itemId: '/showcases/forms', source: 'catalog', match: 'unsurfaced', path: '/showcases/forms' }],
		});
		expect(pass({ kind: 'cites', path: '/showcases/forms' }, recalled)).toBe(false);
		const errored = turn({ toolExecutions: [{ toolName: 'search_catalog', status: 'error' }] });
		expect(pass({ kind: 'calls-tool', tool: 'search_catalog' }, errored)).toBe(false);
		expect(pass({ kind: 'calls-any-tool', tools: ['search_catalog'] }, errored)).toBe(false);
		expect(pass({ kind: 'never-calls', tools: ['search_catalog'] }, errored)).toBe(false);
	});

	it('tool, phrase, approval and outcome checks', () => {
		const t = turn({
			answer: 'Run helm install now',
			toolExecutions: [{ toolName: 'desk_delete_file', status: 'success' }],
			outcome: 'error',
		});
		expect(pass({ kind: 'calls-tool', tool: 'search_catalog' }, t)).toBe(false);
		expect(pass({ kind: 'calls-any-tool', tools: ['search_catalog', 'search_project_docs'] }, t)).toBe(false);
		expect(pass({ kind: 'never-calls', tools: ['desk_delete_file'] }, t)).toBe(false);
		expect(pass({ kind: 'answer-includes', phrases: ['optimistic'] }, t)).toBe(false);
		expect(pass({ kind: 'answer-excludes', phrases: ['HELM INSTALL'] }, t)).toBe(false);
		expect(pass({ kind: 'stops-at-approval' }, t)).toBe(false);
		expect(pass({ kind: 'outcome', is: 'ok' }, t)).toBe(false);
	});
});

describe('scorecard', () => {
	const evalCase: EvalCase = {
		id: 'c',
		surface: 'chatbot',
		question: 'q',
		expect: [{ kind: 'outcome', is: 'ok' }, { kind: 'no-citations' }],
	};

	it('passes a case only when every expectation does', () => {
		expect(scoreCase(evalCase, turn()).pass).toBe(true);
		const failed = scoreCase(evalCase, turn({ outcome: 'error' }));
		expect(failed.pass).toBe(false);
		expect(failed.grades.filter((g) => !g.pass).map((g) => g.kind)).toEqual(['outcome']);
	});

	it('holds or misses the floor', () => {
		const card = scorecard([scoreCase(evalCase, turn()), scoreCase(evalCase, turn({ outcome: 'error' }))]);
		expect(card.passRate).toBe(0.5);
		expect(checkFloor(card, { floor: 0.5 }).ok).toBe(true);
		expect(checkFloor(card, { floor: 0.75 })).toEqual({
			ok: false,
			message: 'pass rate 50.0% is below the floor 75.0%',
		});
	});
});
