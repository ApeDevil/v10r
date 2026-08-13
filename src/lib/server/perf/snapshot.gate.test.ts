import { describe, expect, it } from 'vitest';
import { budgets, ceilings } from './budgets';
import { checkRatchets, isScoreable, type LabSnapshot, scoreSnapshot, snapshot, snapshotAgeDays } from './snapshot';

/**
 * The ratchet.
 *
 * Everything else in the observatory reports; this is the only part that fails a
 * build. Bundle weight is uniquely suited to a gate because it is invisible in
 * review (a one-line import can add 100 KB), deterministic (same source, same
 * number), and only catchable before shipping — by the time RUM reflects it,
 * users already downloaded it.
 *
 * It asserts CEILINGS, not targets. The heaviest route is 609 KB against a 250 KB
 * target, so a gate wired to the target would fail on the commit that introduced
 * it and be muted the same afternoon. Ceilings stop the number growing while the
 * target stays visible on /admin/perf as the thing still to fix.
 */
describe('lab snapshot ratchet', () => {
	it('was generated from a production build', () => {
		expect(
			isScoreable(),
			`snapshot.json records NODE_ENV=${snapshot.nodeEnv}. A dev-mode build inflates client JS ~9%, so its ` +
				'numbers cannot be compared against ceilings measured from a production build. Regenerate:\n' +
				'  podman exec -e NODE_ENV=production v10r bun run build\n' +
				'  podman exec -e NODE_ENV=production v10r bun run scripts/perf/snapshot.ts',
		).toBe(true);
	});

	it.each(checkRatchets())('$metric stays within its accepted ceiling', ({ metric, value, ceiling, exceeds }) => {
		expect(
			exceeds,
			`${metric} grew to ${value} KB, past the accepted ceiling of ${ceiling} KB.\n` +
				'Either find what was added and remove it, or — if the growth is deliberate and worth it — raise the ' +
				`ceiling in src/lib/server/perf/budgets.json as an explicit decision.`,
		).toBe(false);
	});

	// A ceiling naming a metric the snapshot stopped emitting would otherwise pass
	// forever by checking nothing at all.
	it('every ceiling names a metric the snapshot actually measures', () => {
		expect(() => checkRatchets()).not.toThrow();
		expect(Object.keys(ceilings).length).toBeGreaterThan(0);
	});

	// Ratchets are supposed to be tightened. This does not fail the build — it is
	// a nudge that appears in test output when a ceiling has gone slack.
	it('reports ceilings with enough slack to be worth lowering', () => {
		const slack = checkRatchets().filter((r) => r.slackKb > r.ceiling * 0.1);
		if (slack.length > 0) {
			console.info(
				'Perf ratchets can be tightened:\n' +
					slack
						.map((r) => `  ${r.metric}: ${r.value} KB vs ceiling ${r.ceiling} KB (${r.slackKb} KB slack)`)
						.join('\n'),
			);
		}
		expect(Array.isArray(slack)).toBe(true);
	});

	it('carries the provenance needed to reproduce it', () => {
		expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(snapshot.metrics.route_count).toBeGreaterThan(0);
		expect(snapshot.metrics.chunk_count).toBeGreaterThan(0);
	});

	it('scores every target metric against a real budget', () => {
		for (const scored of scoreSnapshot()) {
			expect(budgets[scored.budget], scored.budget).toBeDefined();
			expect(Number.isFinite(scored.value), scored.metric).toBe(true);
			expect(['pass', 'warn', 'fail']).toContain(scored.verdict);
		}
	});

	// Staleness is reported on /admin/perf, never enforced here: a gate that fails
	// because nobody re-ran a build teaches people to skip the gate.
	it('treats an unparseable timestamp as infinitely stale rather than fresh', () => {
		expect(snapshotAgeDays()).toBeGreaterThanOrEqual(0);
		const broken = { ...snapshot, generatedAt: 'not-a-date' } as LabSnapshot;
		expect(snapshotAgeDays(broken)).toBe(Number.POSITIVE_INFINITY);
	});
});
