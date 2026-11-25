/**
 * Scoring a run: every case passes only when all of its expectations do, and the run passes
 * when its pass rate holds the committed floor (`baseline.json`) — a ratchet like
 * `perf/budgets.json`: the floor only rises, each raise logged in its `_comment`.
 *
 * Alias-free.
 */
import type { EvalCase } from './eval-case';
import { type Grade, type GradedTurn, grade } from './graders';

export interface CaseResult {
	id: string;
	pass: boolean;
	grades: (Grade & { kind: string })[];
	/** Set when the turn could not be obtained at all (HTTP error, no trace). */
	error?: string;
	/** `provider/model` of every provider call the case's turns made, deduplicated. */
	models?: string[];
}

export interface Scorecard {
	results: CaseResult[];
	passed: number;
	total: number;
	passRate: number;
}

export interface EvalBaseline {
	_comment?: string;
	/** The pass rate a run must reach, 0–1. */
	floor: number;
}

/**
 * Grade a case over its turns: the question's turn against `expect`, then each scripted
 * follow-up's turn against its own expectations (their kinds read `turn 2: …`). A follow-up
 * whose turn is missing fails every one of its expectations.
 */
export function scoreCase(evalCase: EvalCase, turns: GradedTurn | readonly GradedTurn[]): CaseResult {
	const list: readonly GradedTurn[] = Array.isArray(turns) ? turns : [turns as GradedTurn];
	const [first] = list;
	const grades: CaseResult['grades'] = evalCase.expect.map((e) => ({ kind: e.kind, ...grade(e, first as GradedTurn) }));
	(evalCase.followUps ?? []).forEach((followUp, index) => {
		const turn = list[index + 1];
		for (const e of followUp.expect) {
			const kind = `turn ${index + 2}: ${e.kind}`;
			grades.push(turn ? { kind, ...grade(e, turn) } : { kind, pass: false, detail: 'the turn did not happen' });
		}
	});
	const models = [
		...new Set(
			list.flatMap((turn) =>
				(turn.trace.modelCalls ?? []).map((call) => `${call.providerId ?? 'unknown'}/${call.modelId ?? 'unknown'}`),
			),
		),
	].sort();
	return { id: evalCase.id, pass: grades.every((g) => g.pass), grades, ...(models.length > 0 ? { models } : {}) };
}

export function failedCase(evalCase: EvalCase, error: string): CaseResult {
	return { id: evalCase.id, pass: false, grades: [], error };
}

export function scorecard(results: CaseResult[]): Scorecard {
	const passed = results.filter((r) => r.pass).length;
	return { results, passed, total: results.length, passRate: results.length === 0 ? 0 : passed / results.length };
}

export function checkFloor(card: Scorecard, baseline: EvalBaseline): { ok: boolean; message: string } {
	const rate = (card.passRate * 100).toFixed(1);
	const floor = (baseline.floor * 100).toFixed(1);
	return card.passRate + 1e-9 >= baseline.floor
		? { ok: true, message: `pass rate ${rate}% holds the floor ${floor}%` }
		: { ok: false, message: `pass rate ${rate}% is below the floor ${floor}%` };
}
