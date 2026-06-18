/**
 * Repo-wide leak gate: a SvelteKit `load` return is serialized to the client, so
 * returning `locals.user` wholesale ships internal Better Auth fields (role,
 * banned, banReason, …) to the browser. Every load must project via
 * `publicUser()` instead. This static scan fails the build if any
 * `+page.server.ts` / `+layout.server.ts` returns the raw user object or an
 * obvious secret. A genuine exception can opt out with a `// leak-gate-allow:`
 * marker on the offending line (kept rare by the cap below).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');

function serverLoadFiles(): string[] {
	const entries = readdirSync(ROUTES_DIR, { recursive: true }) as string[];
	return entries
		.filter((e) => e.endsWith('+page.server.ts') || e.endsWith('+layout.server.ts'))
		.map((e) => join(ROUTES_DIR, e));
}

// Patterns that must never appear in a load return (allow-marked lines exempted).
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
	{ re: /\buser:\s*locals\.user\b/, why: 'returns the raw user object (use publicUser())' },
	{ re: /\.\.\.locals\.user\b/, why: 'spreads the raw user object (use publicUser())' },
	{ re: /\b(passwordHash|sessionToken)\b/, why: 'references a secret field' },
];

describe('load leak gate', () => {
	const files = serverLoadFiles();

	it('finds server load files to scan', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('no server load over-returns the raw user or a secret field', () => {
		const violations: string[] = [];
		let allowCount = 0;

		for (const file of files) {
			const lines = readFileSync(file, 'utf8').split('\n');
			lines.forEach((line, i) => {
				if (line.includes('leak-gate-allow:')) {
					allowCount++;
					return;
				}
				for (const { re, why } of FORBIDDEN) {
					if (re.test(line)) {
						violations.push(`${file.replace(process.cwd(), '.')}:${i + 1} — ${why}`);
					}
				}
			});
		}

		expect(violations, violations.join('\n')).toEqual([]);
		// Keep the escape hatch rare — if this trips, the gate is being routed around.
		expect(allowCount).toBeLessThan(5);
	});
});
