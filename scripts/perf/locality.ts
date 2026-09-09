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
 * it locally and that row honestly says it cannot know, which is the point: the function
 * region is a project setting that lives outside this repository, and nothing in the
 * codebase can tell you where the code runs.
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

// The question this map exists to raise. Two blocking hops per request means the
// compute-to-data distance is paid twice on every page, so a compute region nobody has
// checked against a data region we CAN see is the highest-value thing on the list.
const compute = rows.find((r) => r.system.startsWith('compute'));
const data = rows.find((r) => r.provider === 'Neon');
if (compute?.region === null && data?.region) {
	console.log(
		`\nOpen question: the database is in ${data.region} and the function region is unknown from here.\n` +
			'Vercel defaults new projects to iad1 (us-east-1); if that is still the setting, every\n' +
			'blocking hop above crosses an ocean. Check the Vercel project, then either move the\n' +
			'functions or record the decision — an accidental region is the failure this map is for.\n',
	);
} else {
	console.log('');
}
