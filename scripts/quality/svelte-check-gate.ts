#!/usr/bin/env bun
/**
 * Typecheck gate: real `svelte-check` plus a scanned-file floor.
 *
 * The previous checker (svelte-check-rs) kept the gate green while detecting
 * ~5% of the errors real svelte-check finds, and its blanket --ignore globs
 * swallowed the rest — showcase pages could throw at runtime with a passing
 * gate. This wrapper makes that failure mode structurally impossible: it runs
 * the real checker and additionally fails when the scanned-file count
 * collapses, so the gate can never silently regress to checking (almost)
 * nothing again. Machine output is required — it is the only format that
 * reports the scanned-file count.
 *
 * Exit codes:
 *   0  scan completed, zero errors, file count at or above the floor
 *   1  type errors, file count below the floor, or the checker crashed twice
 *
 * The checker is launched on Node directly rather than through `bunx`: Node is
 * the engine the Containerfile provisions for it (see docs/stack/core/bun.md),
 * and the `bunx` hop only added a second Bun process to a chain that has been
 * dying with SIGSEGV. A checker killed by a signal is not a type failure — its
 * verdict is deterministic — so the gate retries ONCE, says so on stderr, and
 * fails only when the retry dies too. A crash is never reported as green: the
 * retry re-scans the whole tree and must produce its own COMPLETED summary.
 *
 * Usage: bun run scripts/quality/svelte-check-gate.ts   (the `check` script wires it after svelte-kit sync)
 */

// Full scan was 10,376 files in 2026-08. The floor catches a checker that
// silently sees a fraction of the tree; lower it only as a deliberate decision
// when the tree genuinely shrinks.
const MIN_FILES = 7000;

async function runChecker(): Promise<{ out: string; exitCode: number; signal: string | null }> {
	const proc = Bun.spawn(
		[
			'node',
			'node_modules/svelte-check/bin/svelte-check',
			'--tsconfig',
			'./tsconfig.json',
			'--output',
			'machine',
			'--threshold',
			'error',
		],
		{ stdout: 'pipe', stderr: 'inherit' },
	);
	const out = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	return { out, exitCode, signal: proc.signalCode ?? null };
}

const SUMMARY_LINE = /^\d+\s+COMPLETED\s/m;

let { out, exitCode, signal } = await runChecker();
if (!SUMMARY_LINE.test(out) && (signal !== null || exitCode > 128)) {
	console.error(
		`svelte-check-gate: checker died by signal (${signal ?? `exit ${exitCode}`}) before completing — a runtime/host fault, not a type error; retrying once.`,
	);
	({ out, exitCode, signal } = await runChecker());
}

const DIAGNOSTIC = /^\d+\s+(ERROR|WARNING)\s+"(.+?)"\s+(\d+):(\d+)\s+"(.*)"$/;
const SUMMARY = /^\d+\s+COMPLETED\s+(\d+)\s+FILES\s+(\d+)\s+ERRORS\s+(\d+)\s+WARNINGS\s+(\d+)\s+FILES_WITH_PROBLEMS$/;

let summary: { files: number; errors: number } | null = null;
for (const line of out.split('\n')) {
	const diag = DIAGNOSTIC.exec(line);
	if (diag) {
		const [, severity, file, ln, col, message] = diag;
		console.error(`  ${file}:${ln}:${col}  ${severity}  ${message.replaceAll('\\n', '\n    ').replaceAll('\\"', '"')}`);
		continue;
	}
	const done = SUMMARY.exec(line);
	if (done) summary = { files: Number(done[1]), errors: Number(done[2]) };
}

if (!summary) {
	console.error(
		`svelte-check-gate: no COMPLETED summary in checker output (crashed? ${signal ?? `exit ${exitCode}`}).`,
	);
	process.exit(1);
}
if (summary.errors > 0 || exitCode !== 0) {
	console.error(`svelte-check-gate: ${summary.errors} error(s) across ${summary.files} scanned files.`);
	process.exit(1);
}
if (summary.files < MIN_FILES) {
	console.error(
		`svelte-check-gate: scanned only ${summary.files} files, floor is ${MIN_FILES} — the checker no longer sees the tree; fix the scan before trusting the gate (scripts/quality/svelte-check-gate.ts).`,
	);
	process.exit(1);
}
console.log(`svelte-check-gate: OK — scanned ${summary.files} files, 0 errors (floor ${MIN_FILES}).`);
