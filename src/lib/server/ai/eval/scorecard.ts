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

export function scoreCase(evalCase: EvalCase, turn: GradedTurn): CaseResult {
	const grades = evalCase.expect.map((e) => ({ kind: e.kind, ...grade(e, turn) }));
	return { id: evalCase.id, pass: grades.every((g) => g.pass), grades };
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
