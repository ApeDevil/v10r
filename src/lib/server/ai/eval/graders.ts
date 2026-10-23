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
		toolExecutions: readonly { toolName: string; status: ToolExecutionStatus }[];
		proposalId: string | null;
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
		case 'outcome':
			return { pass: trace.outcome === expectation.is, detail: `outcome ${trace.outcome}` };
	}
}
