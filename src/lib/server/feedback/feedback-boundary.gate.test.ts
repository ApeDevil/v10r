/**
 * FEEDBACK BOUNDARY GATE — the feedback lifecycle makes no external call.
 *
 * Zero added cost and zero automatic agent activity rest on one structural fact: nothing on
 * the feedback paths talks to a model, a coding agent, GitHub or any other outside service
 * (docs/blueprint/feedback/request-driven-development.md §10). Submissions write one row;
 * admin actions write rows. This pins that, so adding "just one" AI triage call or webhook
 * fails here and has to be argued for in the blueprint first.
 *
 * Honest limit: a scan of imports and call sites in the feedback files, not of everything
 * they transitively reach. The rate limiter's Upstash call is the existing, accepted one and
 * lives in `#lib/server/http/rate-limit.ts`, outside the scanned files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCANNED_DIRS = [
	'src/lib/server/feedback',
	'src/lib/feedback',
	'src/routes/[[locale=locale]]/(public)/feedback',
	'src/routes/[[locale=locale]]/admin/feedback',
	'src/routes/[[locale=locale]]/account/feedback',
];

const FORBIDDEN = [
	{ pattern: /\bfetch\(/, why: 'outbound HTTP' },
	{ pattern: /from '#lib\/server\/ai\//, why: 'model calls' },
	{ pattern: /from '(?:ai|@ai-sdk\/[\w-]+)'/, why: 'model SDK' },
	{ pattern: /from '#lib\/server\/(?:a2a|external-operations|mcp)\//, why: 'agent interoperability' },
	{ pattern: /octokit|api\.github\.com|gitlab\.com|api\.anthropic\.com/, why: 'external service' },
	// Pasted agent reports and shipping receipts are data: nothing on these paths runs code.
	{ pattern: /child_process|\bBun\.spawn|\bexecSync\(|\beval\(|new Function\(/, why: 'code execution' },
];

function files(dir: string): string[] {
	const abs = join(ROOT, dir);
	return (readdirSync(abs, { recursive: true }) as string[])
		.filter((f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f))
		.map((f) => join(dir, f));
}

describe('feedback boundary', () => {
	it('no feedback file calls out to a model, an agent or an external service', () => {
		const offenders: string[] = [];
		for (const file of SCANNED_DIRS.flatMap(files)) {
			const code = readFileSync(join(ROOT, file), 'utf8');
			for (const { pattern, why } of FORBIDDEN) {
				// The admin pages post their own form actions with fetch('?/…'): same-origin, not external.
				const hits = code
					.split('\n')
					.filter((line) => pattern.test(line) && !/fetch\((?:`\/admin\/feedback|'\?\/)/.test(line));
				if (hits.length > 0) offenders.push(`${file}: ${why}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
