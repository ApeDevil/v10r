/**
 * The graders: one pure function per expectation kind, over the turn as the trace recorded
 * it. Each returns pass/fail and a detail line a failing run prints verbatim.
 *
 * Alias-free; the trace types are type-only imports.
 */
import type { CitationRecord, ToolExecutionStatus, TurnOutcome } from '../../../types/turn-trace';
import type { Expectation } from './eval-case';

/** What a grader reads: the answer text and the parts of `TurnTrace` the checks need. */
export interface GradedTurn {
	answer: string;
	trace: {
		outcome: TurnOutcome;
		citations: readonly CitationRecord[];
		toolExecutions: readonly { toolName: string; status: ToolExecutionStatus; output?: unknown }[];
		proposalId: string | null;
		/** The provider calls the turn made — which provider and model answered (`--record`). */
		modelCalls?: readonly { providerId: string | null; modelId: string | null }[];
	};
	/** What the case's earlier turns left behind, for the multi-turn graders. */
	conversation?: {
		/** Surface ids earlier turns of the case rendered. */
		shownSurfaceIds: readonly string[];
		/** The server's answer to re-sending this turn's press verbatim, when the script asked. */
		repeatedPress?: { status: number; body: string };
	};
}

export interface Grade {
	pass: boolean;
	detail: string;
}

const lower = (s: string) => s.toLocaleLowerCase('en');

function citedPaths(turn: GradedTurn): string[] {
	return turn.trace.citations.map((c) => c.path ?? c.itemId);
}

/** Paths the answer cites AND the turn surfaced — a recalled path is not a grounded citation. */
function groundedPaths(turn: GradedTurn): string[] {
	return turn.trace.citations.filter((c) => c.match !== 'unsurfaced').map((c) => c.path ?? c.itemId);
}

interface RenderOutput {
	ok: true;
	surfaceId: string;
	messages: unknown[];
}

/** The turn's `render_surface` results that compiled. */
function validRenders(turn: GradedTurn): RenderOutput[] {
	return turn.trace.toolExecutions
		.filter((t) => t.toolName === 'render_surface' && t.status !== 'error')
		.map((t) => t.output as Partial<RenderOutput> | undefined)
		.filter((o): o is RenderOutput => o?.ok === true && typeof o.surfaceId === 'string' && Array.isArray(o.messages));
}

/** Every component type a batch of A2UI messages creates or updates. */
function componentTypesOf(messages: readonly unknown[]): string[] {
	return messages.flatMap((message) => {
		const m = message as { createSurface?: { components?: unknown }; updateComponents?: { components?: unknown } };
		const list = m?.updateComponents?.components ?? m?.createSurface?.components;
		return (Array.isArray(list) ? list : [])
			.map((c) => (c as { component?: unknown })?.component)
			.filter((type): type is string => typeof type === 'string');
	});
}

/** The surface ids a turn's valid renders addressed — what a later turn may update. */
export function renderedSurfaceIds(turn: GradedTurn): string[] {
	return validRenders(turn).map((output) => output.surfaceId);
}

export function grade(expectation: Expectation, turn: GradedTurn): Grade {
	const { trace, answer } = turn;
	// A call that errored did not do the job the expectation asks for; any call counts for `never-calls`.
	const ran = trace.toolExecutions.filter((t) => t.status !== 'error').map((t) => t.toolName);
	const called = trace.toolExecutions.map((t) => t.toolName);
	switch (expectation.kind) {
		case 'cites-only-surfaced': {
			const unsurfaced = trace.citations.filter((c) => c.match === 'unsurfaced').map((c) => c.path ?? c.itemId);
			return {
				pass: unsurfaced.length === 0,
				detail: unsurfaced.length === 0 ? 'every citation was surfaced' : `unsurfaced: ${unsurfaced.join(', ')}`,
			};
		}
		case 'cites': {
			const paths = groundedPaths(turn);
			const hit = paths.some((p) => p === expectation.path || p.startsWith(`${expectation.path.replace(/\/$/, '')}/`));
			return {
				pass: hit,
				detail: hit ? `cites ${expectation.path}` : `cited [${paths.join(', ')}], not ${expectation.path}`,
			};
		}
		case 'no-citations':
			return {
				pass: trace.citations.length === 0,
				detail: trace.citations.length === 0 ? 'cites nothing' : `cited ${citedPaths(turn).join(', ')}`,
			};
		case 'calls-tool': {
			const pass = ran.includes(expectation.tool);
			return { pass, detail: pass ? `called ${expectation.tool}` : `ran [${ran.join(', ')}]` };
		}
		case 'calls-any-tool': {
			const pass = ran.some((t) => expectation.tools.includes(t));
			return {
				pass,
				detail: pass
					? `called ${ran.filter((t) => expectation.tools.includes(t)).join(', ')}`
					: `ran [${ran.join(', ')}]`,
			};
		}
		case 'never-calls': {
			const forbidden = called.filter((t) => expectation.tools.includes(t));
			return {
				pass: forbidden.length === 0,
				detail: forbidden.length === 0 ? 'no forbidden tool' : `called ${forbidden.join(', ')}`,
			};
		}
		case 'answer-includes': {
			const missing = expectation.phrases.filter((p) => !lower(answer).includes(lower(p)));
			return {
				pass: missing.length === 0,
				detail: missing.length === 0 ? 'all phrases present' : `missing: ${missing.join(' | ')}`,
			};
		}
		case 'answer-excludes': {
			const present = expectation.phrases.filter((p) => lower(answer).includes(lower(p)));
			return {
				pass: present.length === 0,
				detail: present.length === 0 ? 'no excluded phrase' : `present: ${present.join(' | ')}`,
			};
		}
		case 'stops-at-approval': {
			const pass = trace.outcome === 'awaiting_decision' && trace.proposalId !== null;
			return {
				pass,
				detail: pass ? 'stopped on a proposal' : `outcome ${trace.outcome}, proposal ${trace.proposalId ?? 'none'}`,
			};
		}
		case 'renders-valid-surface': {
			const renders = trace.toolExecutions.filter((t) => t.toolName === 'render_surface');
			const firstOk = renders.findIndex(
				(t) => t.status !== 'error' && (t.output as { ok?: unknown } | undefined)?.ok === true,
			);
			const attempts = firstOk + 1;
			const pass = firstOk >= 0 && attempts <= (expectation.maxAttempts ?? Number.POSITIVE_INFINITY);
			return {
				pass,
				detail:
					firstOk >= 0 ? `valid surface after ${attempts} call(s)` : `${renders.length} render call(s), none valid`,
			};
		}
		case 'renders-component': {
			const types = validRenders(turn).flatMap((output) => componentTypesOf(output.messages));
			const pass = types.includes(expectation.component);
			return {
				pass,
				detail: pass ? `rendered a ${expectation.component}` : `rendered [${[...new Set(types)].join(', ')}]`,
			};
		}
		case 'updates-surface': {
			const shown = turn.conversation?.shownSurfaceIds ?? [];
			const updated = renderedSurfaceIds(turn).filter((id) => shown.includes(id));
			return {
				pass: updated.length > 0,
				detail: updated.length > 0 ? `updated ${updated.join(', ')}` : `no update of [${shown.join(', ')}]`,
			};
		}
		case 'refuses-repeated-press': {
			const answer = turn.conversation?.repeatedPress;
			const pass = answer?.status === 409 && answer.body.includes('duplicate_event');
			return {
				pass,
				detail: answer ? `repeat answered ${answer.status} ${answer.body.slice(0, 120)}` : 'the press was not resent',
			};
		}
		case 'outcome':
			return { pass: trace.outcome === expectation.is, detail: `outcome ${trace.outcome}` };
	}
}
