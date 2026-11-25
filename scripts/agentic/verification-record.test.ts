/**
 * The ship verdict: a blocked mandatory step, a missing mandatory attestation or a dirty tree is
 * never ready; any failure fails; development tiers never claim a ship verdict; the record keeps
 * no credential.
 */
import { describe, expect, it } from 'vitest';
import {
	environmentOf,
	MANUAL_CHECKS,
	parseAttestations,
	parseSteps,
	redactedOrigin,
	type VerificationStep,
	verdictOf,
} from './verification-record';

const step = (over: Partial<VerificationStep> = {}): VerificationStep => ({
	id: 'validate',
	title: 'validate',
	requirement: 'mandatory',
	status: 'passed',
	seconds: 1,
	detail: '',
	...over,
});

const allAttested = parseAttestations(MANUAL_CHECKS.map((c) => `${c.id} pass`).join('\n'));
const mandatoryAttested = parseAttestations(
	MANUAL_CHECKS.filter((c) => c.requirement === 'mandatory')
		.map((c) => `${c.id} pass`)
		.join('\n'),
);

describe('verdictOf', () => {
	it('is ready only when every mandatory step passed, every mandatory check is attested and the tree is clean', () => {
		expect(verdictOf('strict', [step()], mandatoryAttested, true)).toEqual({
			verdict: 'ready',
			exitCode: 0,
			reasons: [],
		});
	});

	it('a mandatory step whose prerequisite is missing blocks — it is never a pass', () => {
		const report = verdictOf(
			'strict',
			[step(), step({ id: 'eval-golden', status: 'blocked', detail: 'V10R_COOKIE not set' })],
			allAttested,
			true,
		);
		expect(report.verdict).toBe('blocked');
		expect(report.exitCode).toBe(3);
		expect(report.reasons.join()).toContain('eval-golden');
	});

	it('an optional step that did not run does not block', () => {
		const report = verdictOf(
			'strict',
			[step(), step({ id: 'claude-compat', requirement: 'optional', status: 'skipped' })],
			mandatoryAttested,
			true,
		);
		expect(report.verdict).toBe('ready');
	});

	it('a missing mandatory manual attestation blocks; missing optional ones do not', () => {
		expect(verdictOf('strict', [step()], parseAttestations(null), true).verdict).toBe('blocked');
		const report = verdictOf('strict', [step()], parseAttestations('vely-grounded pass'), true);
		expect(report.reasons.some((r) => r.includes('genui-form'))).toBe(true);
		expect(report.reasons.some((r) => r.includes('webmcp'))).toBe(false);
	});

	it('a dirty tree blocks: the record would not be of the commit', () => {
		expect(verdictOf('strict', [step()], allAttested, false).verdict).toBe('blocked');
	});

	it('any failure fails, step or manual check, in every tier', () => {
		expect(verdictOf('strict', [step({ status: 'failed' })], allAttested, true).exitCode).toBe(1);
		expect(verdictOf('offline', [step({ status: 'failed' })], [], true).verdict).toBe('failed');
		expect(verdictOf('strict', [step()], parseAttestations('mcp-peer fail drift not withheld'), true).verdict).toBe(
			'failed',
		);
	});

	it('a development tier passes without claiming a ship verdict, even with blocked steps', () => {
		const report = verdictOf('all', [step({ status: 'blocked' })], [], false);
		expect(report).toEqual({ verdict: 'passed', exitCode: 0, reasons: ['development tier: not a ship verdict'] });
	});
});

describe('parsing', () => {
	it('reads the tab-separated steps verify.sh writes', () => {
		const [parsed] = parseSteps('a2a-interop\tmandatory\tblocked\t0\tA2A interop\tuv not installed\n');
		expect(parsed).toEqual({
			id: 'a2a-interop',
			requirement: 'mandatory',
			status: 'blocked',
			seconds: 0,
			title: 'A2A interop',
			detail: 'uv not installed',
		});
	});

	it('reads attestations, ignoring comments; an unknown verdict is not recorded', () => {
		const parsed = parseAttestations('# comment\nvely-grounded pass looked right\ngenui-form maybe\n');
		expect(parsed.find((m) => m.id === 'vely-grounded')).toMatchObject({ status: 'passed', note: 'looked right' });
		expect(parsed.find((m) => m.id === 'genui-form')?.status).toBe('not_recorded');
	});
});

describe('the record holds no credential', () => {
	it('keeps the base URL origin only, dropping userinfo and query', () => {
		expect(redactedOrigin('http://user:hunter2@localhost:5173/x?token=abc')).toBe('http://localhost:5173');
		expect(redactedOrigin('not a url')).toBeNull();
	});

	it('never reads the cookie or a key into the environment section', () => {
		const env = environmentOf({
			V10R_COOKIE: 'better-auth.session_token=SECRET-COOKIE',
			OPENAI_API_KEY: 'sk-SECRET',
			V10R_BASE_URL: 'http://localhost:5173',
		});
		const text = JSON.stringify(env);
		expect(text).not.toContain('SECRET');
		expect(env.baseUrl).toBe('http://localhost:5173');
	});
});
