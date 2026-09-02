/**
 * RETENTION GATE.
 *
 * The retention schedule is a published promise: `/showcases/privacy/retention` renders it,
 * and the cron sweeps enforce it. Those two used to be separate hand-kept lists — the page
 * showed four windows while seven jobs enforced fourteen — so this file is what keeps the
 * promise and its enforcement from drifting apart again.
 *
 * What is NOT asserted here, because the type system already does it: that every rule has
 * reader-facing copy. `showcases/privacy/retention-copy.ts` is typed
 * `Record<RetentionRuleId, …>`, so adding a rule without explaining it fails to compile.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jobs } from '$lib/server/jobs';
import { retentionSchedule } from './schedule';

const JOBS_DIR = join(process.cwd(), 'src/lib/server/jobs');

/**
 * Sweeps that delete by an intrinsic deadline the row was born with, rather than by a
 * retention window we chose. A verification token and an expired session are collected
 * when their own `expires_at` passes; listing them as "retention" would publish a promise
 * about data whose lifetime was never ours to set.
 */
const EXPIRY_DRIVEN_SWEEPS = ['session-cleanup', 'telegram-token-cleanup'];

describe('retention schedule', () => {
	it('every rule names a job that exists', () => {
		const unknown = retentionSchedule.map((r) => r.job).filter((slug) => !(slug in jobs));
		expect([...new Set(unknown)]).toEqual([]);
	});

	it('rule ids are unique', () => {
		const ids = retentionSchedule.map((r) => r.id);
		expect(ids).toEqual([...new Set(ids)]);
	});

	it('windows are positive whole numbers of days', () => {
		for (const rule of retentionSchedule) {
			expect(Number.isInteger(rule.days), `${rule.id} days must be a whole number`).toBe(true);
			expect(rule.days, `${rule.id} days must be positive`).toBeGreaterThan(0);
		}
	});

	/**
	 * The load-bearing one. A job that computes its own cutoff from a local constant is a
	 * second source of truth for a published number, which is exactly the state this
	 * schedule replaced.
	 */
	it('no job hard-codes a retention window', () => {
		const offenders: string[] = [];
		for (const slug of Object.keys(jobs)) {
			if (EXPIRY_DRIVEN_SWEEPS.includes(slug)) continue;
			let source: string;
			try {
				source = readFileSync(join(JOBS_DIR, `${slug}.ts`), 'utf8');
			} catch {
				continue;
			}
			if (/RETENTION_DAYS|ARCHIVE_DAYS|DELETE_DAYS/.test(source)) offenders.push(slug);
		}
		expect(offenders, 'these jobs must read `retention/schedule.ts` instead').toEqual([]);
	});

	/** Every job the schedule points at must actually consult it. */
	it('every job named by a rule reads the schedule', () => {
		const missing: string[] = [];
		for (const slug of [...new Set(retentionSchedule.map((r) => r.job))]) {
			const source = readFileSync(join(JOBS_DIR, `${slug}.ts`), 'utf8');
			if (!/from '\$lib\/server\/retention'/.test(source)) missing.push(slug);
		}
		expect(missing).toEqual([]);
	});
});
