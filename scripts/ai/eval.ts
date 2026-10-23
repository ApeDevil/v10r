#!/usr/bin/env bun
/**
 * Run the AI golden set against a running dev server and grade every recorded turn
 * (`src/lib/server/ai/eval/`, docs/blueprint/ai/evals.md).
 *
 *   podman exec v10r bun run ai:eval -- --cookie 'better-auth.session_token=…'
 *       [--base http://localhost:5173] [--only <case-id>,…] [--keep] [--check]
 *
 * Needs what a real turn needs — a dev server with saved provider connections and the
 * database — so it runs locally, never in `validate`. `--check` exits 1 when the pass rate is
 * below `baseline.json`'s floor. Every case opens a new conversation under your account and
 * deletes it once graded (an account holds a capped number); `--keep` leaves them for the
 * turn inspector.
 */
import { readFileSync } from 'node:fs';
import { safeParse } from 'valibot';
import { GoldenSetSchema } from '../../src/lib/server/ai/eval/eval-case';
import { createHttpEvalClient, runEval } from '../../src/lib/server/ai/eval/run-eval';
import { checkFloor, type EvalBaseline } from '../../src/lib/server/ai/eval/scorecard';

const EVAL_DIR = 'src/lib/server/ai/eval';

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
}

const cookie = arg('cookie') ?? process.env.V10R_COOKIE;
if (!cookie) {
	console.error('Missing --cookie (or V10R_COOKIE): the signed-in session cookie, e.g. better-auth.session_token=…');
	process.exit(1);
}
const base = arg('base') ?? 'http://localhost:5173';
const only = arg('only')?.split(',');

const parsed = safeParse(GoldenSetSchema, JSON.parse(readFileSync(`${EVAL_DIR}/golden-cases.json`, 'utf8')));
if (!parsed.success) {
	console.error('golden-cases.json does not match the eval case schema:', parsed.issues[0]?.message);
	process.exit(1);
}
const cases = only ? parsed.output.cases.filter((c) => only.includes(c.id)) : parsed.output.cases;
if (cases.length === 0) {
	console.error(`[ai:eval] no case matches --only ${only?.join(',')}`);
	process.exit(1);
}
const baseline = JSON.parse(readFileSync(`${EVAL_DIR}/baseline.json`, 'utf8')) as EvalBaseline;

console.log(`[ai:eval] ${cases.length} case(s) against ${base}`);
const card = await runEval(cases, createHttpEvalClient({ base, cookie, keep: process.argv.includes('--keep') }));

for (const result of card.results) {
	console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.id}`);
	if (result.error) console.log(`      ${result.error}`);
	for (const g of result.grades) if (!g.pass) console.log(`      ${g.kind}: ${g.detail}`);
}
const verdict = checkFloor(card, baseline);
console.log(`[ai:eval] ${card.passed}/${card.total} passed — ${verdict.message}`);
if (process.argv.includes('--check') && !verdict.ok) process.exit(1);
