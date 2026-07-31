/**
 * ACTION CONTRACT GATE — form actions must not return a raw `Response`.
 *
 * SvelteKit serializes a form action's return value with devalue; a `Response`
 * (from `rateLimitResponse`, `json(...)`, or `new Response(...)`) is not a
 * POJO, so the denial becomes `Cannot stringify arbitrary non-POJOs` → a 500.
 * The feedback page's rate-limit branch shipped exactly this: the 4th
 * submission per hour hit a server-error page instead of a 429 message.
 *
 * The sibling `guard-contract.gate.test.ts` pins the same class of mistake for
 * `+server.ts` endpoints (thrown Responses); this one pins `+page.server.ts`
 * actions. Actions signal failure with `fail()` / `message()` and success with
 * a POJO or a thrown `redirect()`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function pageServerFiles(): string[] {
	const routes = join(SRC, 'routes');
	return (readdirSync(routes, { recursive: true }) as string[])
		.filter((e) => e.endsWith('+page.server.ts'))
		.map((e) => join(routes, e));
}

const RAW_RESPONSE_RETURN = /return\s+(?:rateLimitResponse|json|new\s+Response)\s*\(/;

describe('action contract', () => {
	it('no +page.server.ts with actions returns a raw Response', () => {
		const offenders: string[] = [];
		for (const file of pageServerFiles()) {
			const code = readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*$/gm, '');
			if (!/export\s+const\s+actions/.test(code)) continue;
			if (RAW_RESPONSE_RETURN.test(code)) {
				offenders.push(file.replace(SRC, 'src'));
			}
		}
		expect(
			offenders,
			`Form actions must return fail()/message()/POJO — a raw Response is not devalue-serializable and 500s. Offenders:\n  ${offenders.join('\n  ')}`,
		).toEqual([]);
	});
});
