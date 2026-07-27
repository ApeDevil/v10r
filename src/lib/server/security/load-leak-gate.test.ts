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

/**
 * Every file whose return value crosses to the client.
 *
 * Originally only `+page.server.ts` / `+layout.server.ts`. Widened because the
 * other two are just as exposed: `+server.ts` serialises whatever it puts in
 * `json()`, and a universal `+page.ts` / `+layout.ts` load runs in the browser
 * as well, so anything it returns is client-visible by definition.
 */
function clientFacingFiles(): string[] {
	const entries = readdirSync(ROUTES_DIR, { recursive: true }) as string[];
	return entries
		.filter(
			(e) =>
				e.endsWith('+page.server.ts') ||
				e.endsWith('+layout.server.ts') ||
				e.endsWith('+server.ts') ||
				e.endsWith('+page.ts') ||
				e.endsWith('+layout.ts'),
		)
		.map((e) => join(ROUTES_DIR, e));
}

/**
 * Patterns that must never appear in something client-facing (allow-marked
 * lines exempted).
 *
 * Deliberately matches the BINDING as well as the literal spread: the original
 * three-substring version was defeated by `const u = locals.user; return { u }`,
 * i.e. by a rename. Still a heuristic — it cannot follow a value through a
 * helper, and a fresh unprojected DB re-read of the same row never mentions
 * `locals` at all. Catching that needs type-aware analysis; this catches the
 * shapes people actually write.
 */
const FORBIDDEN: Array<{ re: RegExp; why: string }> = [
	{ re: /\buser:\s*locals\.user\b/, why: 'returns the raw user object (use publicUser())' },
	{ re: /\.\.\.locals\.user\b/, why: 'spreads the raw user object (use publicUser())' },
	{ re: /\bsession:\s*locals\.session\b/, why: 'returns the raw session (it carries the token)' },
	{ re: /\.\.\.locals\.session\b/, why: 'spreads the raw session (it carries the token)' },
	{ re: /\b(passwordHash|sessionToken)\b/, why: 'references a secret field' },
];

/**
 * The rename case, which a per-line scan cannot see:
 *
 *   const u = locals.user;
 *   return { u };            // ships the whole object, matches no literal above
 *
 * Two passes per file — collect identifiers bound from `locals.user` /
 * `locals.session`, then flag only those that are actually RETURNED as a
 * property. Deliberately not "flag every binding": `const user = locals.user`
 * followed by `signedIn: !!user` is fine and common, and a gate that shouts
 * about it just teaches people to add allow-markers.
 */
function leakedBindings(source: string): string[] {
	const bound = [...source.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*locals\.(?:user|session)\s*;/g)].map((m) => m[1]);
	if (bound.length === 0) return [];

	const leaked = new Set<string>();
	for (const returnBlock of source.matchAll(/return\s*\{([\s\S]*?)\n\t*\};/g)) {
		const body = returnBlock[1];
		for (const name of bound) {
			// `{ u }` shorthand, `{ u, ... }`, or `{ user: u }` — but not `!!u`.
			const shorthand = new RegExp(`(^|[\\s{,])${name}\\s*(,|$)`, 'm');
			const asValue = new RegExp(`:\\s*${name}\\s*(,|$)`, 'm');
			if (shorthand.test(body) || asValue.test(body)) leaked.add(name);
		}
	}
	return [...leaked];
}

describe('load leak gate', () => {
	const files = clientFacingFiles();

	it('finds client-facing files to scan', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('no client-facing file over-returns the raw user or a secret field', () => {
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

	it('no client-facing file returns a value bound from locals.user/session', () => {
		const violations: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			if (source.includes('leak-gate-allow:')) continue;
			for (const name of leakedBindings(source)) {
				violations.push(
					`${file.replace(process.cwd(), '.')} — returns \`${name}\`, bound from locals.user/session. Project the fields instead.`,
				);
			}
		}
		expect(violations, violations.join('\n')).toEqual([]);
	});
});
