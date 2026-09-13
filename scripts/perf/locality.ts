#!/usr/bin/env bun
/**
 * Print the deployment locality map.
 *
 *   podman exec v10r bun run perf:locality
 *
 * Regions only — never a host, never a credential. `describeLocality` extracts the region
 * token and drops everything else, and `locality.test.ts` asserts that it does; this file
 * is only the renderer.
 *
 * Run it inside a Vercel function and the compute row fills in from `VERCEL_REGION`. Run
 * it locally and that row honestly says it cannot know: `svelte.config.js` declares the
 * region (`regions: ['fra1']`, next to Neon's eu-central-1), and only a running function
 * can confirm the deployment honours it — measured 2026-09-13, before the declaration,
 * every function ran in `iad1` (`x-vercel-id: fra1::iad1::…`).
 */
import { CRITICAL_PATH_HOPS, describeLocality } from '$lib/server/perf/locality';

const rows = describeLocality(process.env);
const width = Math.max(...rows.map((r) => r.system.length));

console.log('\nWhere each system runs\n');
for (const row of rows) {
	console.log(
		`  ${row.system.padEnd(width)}  ${(row.region ?? '—').padEnd(14)} ${row.provider.padEnd(15)} ${row.source}`,
	);
}

console.log('\nCross-region calls on a request\n');
for (const hop of CRITICAL_PATH_HOPS) {
	console.log(`  ${hop.blocking ? 'blocking' : 'async   '}  ${hop.from} → ${hop.to}\n            ${hop.note}`);
}

const unknown = rows.filter((r) => r.region === null).length;
console.log(`\n${rows.length - unknown} of ${rows.length} regions are observable from here.`);

// The question this map exists to keep answered. Two blocking hops per request means the
// compute-to-data distance is paid twice on every page, so the compute region must be checked
// against a data region we CAN see — in situ, where `VERCEL_REGION` is set.
const compute = rows.find((r) => r.system.startsWith('compute'));
const data = rows.find((r) => r.provider === 'Neon');
if (compute?.region === null && data?.region) {
	console.log(
		`\nThe database is in ${data.region}; svelte.config.js declares the functions for fra1. Only a\n` +
			'running function can confirm the deployment honours that — read `x-vercel-id` on a\n' +
			'response (edge::function::id) or run this probe in situ. An accidental region is the\n' +
			'failure this map is for.\n',
	);
} else {
	console.log('');
}
