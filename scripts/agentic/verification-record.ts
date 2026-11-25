#!/usr/bin/env bun
/**
 * The verification record of `scripts/agentic/verify.sh`: the verdict over the steps it ran,
 * and a JSON record of exactly what was verified — commit, tree state, environment, provider
 * and model — never a credential.
 *
 *   bun scripts/agentic/verification-record.ts --steps <steps.tsv> --tier <tier> --out <record.json>
 *       [--manual <attestation.txt>] [--evals <eval-record.json>,…]
 *
 * Each step has a requirement (`mandatory` for shipping, or `optional`) and a status:
 * `passed`, `failed`, `skipped` (an optional step whose prerequisite is missing) or `blocked`
 * (externally blocked: a mandatory step whose prerequisite is missing — a server, a key, `uv`).
 *
 * The `strict` tier is the ship verdict. It is `ready` only when every mandatory step passed,
 * every mandatory manual check is attested `pass`, and the tree is clean (a dirty tree is not the
 * commit being verified). A blocked mandatory step is never a pass: the verdict is `blocked`.
 * Any failure is `failed`. The development tiers report `passed` or `failed` and never claim a
 * ship verdict. Exit codes: 0 ready / passed, 1 failed, 3 blocked.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { release as osRelease } from 'node:os';

export type StepRequirement = 'mandatory' | 'optional';
export type StepStatus = 'passed' | 'failed' | 'skipped' | 'blocked';

export interface VerificationStep {
	id: string;
	title: string;
	requirement: StepRequirement;
	status: StepStatus;
	seconds: number;
	detail: string;
}

export interface ManualCheck {
	id: string;
	title: string;
	requirement: StepRequirement;
}

export interface ManualAttestation {
	id: string;
	title: string;
	requirement: StepRequirement;
	status: 'passed' | 'failed' | 'not_recorded';
	note: string;
}

/**
 * The by-hand checks of `verification.md` §3, by id. An attestation file lists one per line:
 * `<id> pass|fail <note>`. Optional ones are recorded when attested and never block.
 */
export const MANUAL_CHECKS: readonly ManualCheck[] = [
	{ id: 'vely-grounded', title: 'Vely grounded answer with pattern chips and a trace', requirement: 'mandatory' },
	{
		id: 'genui-form',
		title: 'Generative requirements form: submit, follow-up, restore on reload, repeat refused',
		requirement: 'mandatory',
	},
	{ id: 'deskbot-approve-revert', title: 'Deskbot plan card: approve, receipt, undo', requirement: 'mandatory' },
	{
		id: 'mcp-peer',
		title: 'Live MCP peer: read, disposable mutation, complete-arguments inspection, revocation, drift',
		requirement: 'mandatory',
	},
	{
		id: 'a2a-delegation',
		title: 'Live A2A delegation: card, receipt with remote task, budget',
		requirement: 'mandatory',
	},
	{ id: 'ag-ui', title: 'AG-UI client against /api/ai/ag-ui/deskbot', requirement: 'mandatory' },
	{
		id: 'mcp-apps-inspector',
		title: 'MCP App explore_patterns rendered in the MCP Inspector',
		requirement: 'mandatory',
	},
	{ id: 'mcp-apps-hosts', title: 'MCP App in another host (Claude, ChatGPT, VS Code)', requirement: 'optional' },
	{ id: 'webmcp', title: 'WebMCP in a browser that ships navigator.modelContext', requirement: 'optional' },
	{ id: 'skills-production', title: 'Agent Skills install from production (after a deploy)', requirement: 'optional' },
];

export function parseSteps(tsv: string): VerificationStep[] {
	return tsv
		.split('\n')
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const [id = '', requirement = 'mandatory', status = 'failed', seconds = '0', title = '', detail = ''] =
				line.split('\t');
			return {
				id,
				title,
				requirement: requirement === 'optional' ? 'optional' : 'mandatory',
				status: (['passed', 'failed', 'skipped', 'blocked'] as const).find((s) => s === status) ?? 'failed',
				seconds: Number(seconds) || 0,
				detail,
			};
		});
}

export function parseAttestations(text: string | null): ManualAttestation[] {
	const lines = new Map<string, { verdict: string; note: string }>();
	for (const raw of (text ?? '').split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const [id = '', verdict = '', ...note] = line.split(/\s+/);
		lines.set(id, { verdict, note: note.join(' ') });
	}
	return MANUAL_CHECKS.map((check) => {
		const entry = lines.get(check.id);
		const status = entry?.verdict === 'pass' ? 'passed' : entry?.verdict === 'fail' ? 'failed' : 'not_recorded';
		return { ...check, status, note: entry?.note ?? '' };
	});
}

export type Verdict = 'ready' | 'blocked' | 'failed' | 'passed';

export interface VerdictReport {
	verdict: Verdict;
	exitCode: 0 | 1 | 3;
	reasons: string[];
}

/** The rule above, as one function. */
export function verdictOf(
	tier: string,
	steps: readonly VerificationStep[],
	manual: readonly ManualAttestation[],
	treeClean: boolean,
): VerdictReport {
	const failed = [
		...steps.filter((s) => s.status === 'failed').map((s) => `step failed: ${s.id}`),
		...manual.filter((m) => m.status === 'failed').map((m) => `manual check failed: ${m.id}`),
	];
	if (failed.length > 0) return { verdict: 'failed', exitCode: 1, reasons: failed };
	if (tier !== 'strict') return { verdict: 'passed', exitCode: 0, reasons: ['development tier: not a ship verdict'] };
	const blocked = [
		...(treeClean ? [] : ['the tree has uncommitted changes: the record is not of the commit']),
		...steps
			.filter((s) => s.requirement === 'mandatory' && s.status !== 'passed')
			.map((s) => `mandatory step ${s.status}: ${s.id}${s.detail ? ` (${s.detail})` : ''}`),
		...manual
			.filter((m) => m.requirement === 'mandatory' && m.status !== 'passed')
			.map((m) => `mandatory manual check not attested: ${m.id}`),
	];
	return blocked.length > 0
		? { verdict: 'blocked', exitCode: 3, reasons: blocked }
		: { verdict: 'ready', exitCode: 0, reasons: [] };
}

/** An origin with any userinfo removed; never a path, query or credential. */
export function redactedOrigin(url: string | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

function run(command: string, args: string[]): string | null {
	try {
		return execFileSync(command, args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 15_000,
		}).trim();
	} catch {
		return null;
	}
}

interface EvalRecord {
	passed: number;
	total: number;
	floorOk: boolean;
	models: string[];
}

function readEval(path: string): (EvalRecord & { file: string }) | null {
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as EvalRecord;
		return {
			file: path,
			passed: parsed.passed,
			total: parsed.total,
			floorOk: parsed.floorOk,
			models: parsed.models ?? [],
		};
	} catch {
		return null;
	}
}

/** Only named, non-secret values: versions, ids, flags. The cookie and keys are never read here. */
export function environmentOf(env: Record<string, string | undefined>) {
	return {
		platform: `${process.platform} ${osRelease()}`,
		bun: typeof Bun === 'undefined' ? null : Bun.version,
		node: run('node', ['--version']),
		uv: run('uv', ['--version']),
		claudeCode: run('claude', ['--version']),
		container: existsSync('/run/.containerenv') || existsSync('/.dockerenv'),
		cloudSession: env.CLAUDE_CODE_REMOTE === 'true',
		baseUrl: redactedOrigin(env.V10R_BASE_URL ?? 'http://localhost:5173'),
		compatModel: env.V10R_COMPAT_MODEL ?? 'default (your Claude Code config)',
	};
}

function arg(name: string): string | undefined {
	const at = process.argv.indexOf(`--${name}`);
	return at === -1 ? undefined : process.argv[at + 1];
}

const LABEL: Record<StepStatus | ManualAttestation['status'], string> = {
	passed: 'Passed',
	failed: 'Failed',
	skipped: 'Skipped',
	blocked: 'Externally blocked',
	not_recorded: 'Not recorded',
};

if (import.meta.main) {
	const tier = arg('tier') ?? 'offline';
	const steps = parseSteps(readFileSync(arg('steps') ?? '/dev/null', 'utf8'));
	const manualPath = arg('manual');
	const manual = parseAttestations(manualPath && existsSync(manualPath) ? readFileSync(manualPath, 'utf8') : null);
	const status = run('git', ['status', '--porcelain']);
	const treeClean = status === '';
	const evals = (arg('evals') ?? '')
		.split(',')
		.filter(Boolean)
		.map(readEval)
		.filter((record) => record !== null);
	const report = verdictOf(tier, steps, manual, treeClean);
	const record = {
		tier,
		verdict: report.verdict,
		reasons: report.reasons,
		commit: run('git', ['rev-parse', 'HEAD']),
		branch: run('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
		treeClean,
		recordedAt: new Date().toISOString(),
		environment: environmentOf(process.env),
		providerModels: [...new Set(evals.flatMap((e) => e.models))].sort(),
		evals,
		steps,
		manual: tier === 'strict' ? manual : [],
	};
	const out = arg('out');
	if (out) writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);

	console.log();
	for (const step of steps) {
		console.log(
			`${LABEL[step.status].padEnd(18)} ${step.requirement === 'mandatory' ? 'Mandatory' : 'Optional '}  ${step.title}${step.detail ? ` — ${step.detail}` : ''}`,
		);
	}
	if (tier === 'strict') {
		for (const check of manual) {
			console.log(
				`${LABEL[check.status].padEnd(18)} ${check.requirement === 'mandatory' ? 'Mandatory' : 'Optional '}  [manual] ${check.title}`,
			);
		}
	}
	console.log();
	console.log(`commit ${record.commit ?? 'unknown'} (${treeClean ? 'clean tree' : 'UNCOMMITTED CHANGES'})`);
	console.log(
		`provider/model: ${record.providerModels.length > 0 ? record.providerModels.join(', ') : 'none recorded'}`,
	);
	const headline =
		report.verdict === 'ready'
			? 'SHIP-READY: every mandatory check passed on this commit'
			: report.verdict === 'blocked'
				? 'NOT SHIP-READY: mandatory checks did not run'
				: report.verdict === 'failed'
					? 'FAILED'
					: 'PASSED (development tier, not a ship verdict)';
	console.log(headline);
	for (const reason of report.reasons) console.log(`  - ${reason}`);
	if (out) console.log(`record: ${out}`);
	process.exit(report.exitCode);
}
