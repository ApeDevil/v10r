/**
 * CSRF TRANSPORT GATE — client code must reach mutating `/api/` routes through `apiFetch`.
 *
 * `csrfProtection` rejects any mutating `/api/` request outside
 * `CSRF_EXEMPT_PREFIXES` that lacks an `X-Requested-With` header, and it does so
 * in the hook — BEFORE routing. A bare `fetch` therefore fails with 403
 * `csrf_failed` and never reaches the endpoint, so the endpoint's own tests keep
 * passing while the feature is dead in the browser.
 *
 * That is not hypothetical: eight calls in `DockLayout.svelte` shipped this way.
 * Desk theme saves, preset create/delete, and all four workspace mutations were
 * silently 403ing, three of them behind a bare `catch {}`. Nothing caught it —
 * not typecheck, not lint, not the test suite — because every one of them is
 * *syntactically* fine.
 *
 * ── Honest limits ────────────────────────────────────────────────────────────
 *
 * Only STRING-LITERAL urls are visible. A `fetch(endpoint, …)` where `endpoint`
 * is a variable is invisible here, as is a method held in a variable. And this
 * proves a call *looks* right — that it carries the header — not that it is
 * correct in any other respect.
 *
 * It is a regression net for "somebody used bare fetch again", which is the
 * failure that actually happened. Widen the matcher rather than the allowlist.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSRF_EXEMPT_PREFIXES } from './server/security/csrf';

const SRC_DIR = join(process.cwd(), 'src');

/**
 * Client-reachable sources only. `src/lib/server/**` and `src/routes/**` server
 * modules run inside the request, where a same-origin call does not traverse the
 * hook the way a browser call does.
 */
function isScanned(relative: string): boolean {
	if (!/\.(svelte|ts)$/.test(relative)) return false;
	if (relative.endsWith('.d.ts') || relative.includes('.test.')) return false;
	if (relative.startsWith('lib/server/') || relative.startsWith('lib/paraglide/')) return false;
	// Server-side route modules: +page.server.ts, +server.ts, +layout.server.ts, hooks.
	if (/(^|\/)(\+.*\.server\.ts|\+server\.ts|hooks\.server\.ts)$/.test(relative)) return false;
	return relative !== 'lib/api.ts';
}

/** `fetch('/api/…'` or `fetch(`/api/…`` — but never `apiFetch(`. */
const FETCH_CALL = /(?<![\w$.])fetch\(\s*(['"`])(\/api\/[^'"`]*)\1?/g;
const MUTATING_METHOD = /method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/;
/** The header itself, or the shared constant that carries it. */
const CARRIES_HEADER = /x-requested-with|CSRF_HEADER/i;
/** `headers: IDENT` / `headers: { ...IDENT }` — resolved against the file. */
const HEADERS_IDENT = /headers:\s*\{?\s*(?:\.\.\.)?([A-Z_][A-Z0-9_]*)\b/;

/**
 * Text of the `fetch(...)` call, paren-balanced.
 *
 * A fixed-size window is wrong: it overruns into the NEXT statement, so a
 * plain `fetch(url)` GET followed by an unrelated mutating call reads as a
 * violation. Balancing stops exactly at the call's own closing paren.
 */
function callText(source: string, start: number): string {
	let depth = 0;
	for (let i = source.indexOf('(', start); i < source.length; i++) {
		const ch = source[i];
		if (ch === '(') depth++;
		else if (ch === ')') {
			depth--;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	return source.slice(start);
}

function isExempt(path: string): boolean {
	return CSRF_EXEMPT_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
	);
}

function walk(): string[] {
	return (readdirSync(SRC_DIR, { recursive: true }) as string[]).map((p) => p.split('\\').join('/')).filter(isScanned);
}

/** Offenders as `relative:line — /api/path`. */
function findBareMutatingFetches(): string[] {
	const offenders: string[] = [];
	for (const relative of walk()) {
		const source = readFileSync(join(SRC_DIR, relative), 'utf8');
		for (const match of source.matchAll(FETCH_CALL)) {
			const url = match[2];
			if (isExempt(url)) continue;
			const call = callText(source, match.index);
			if (!MUTATING_METHOD.test(call)) continue;
			if (CARRIES_HEADER.test(call)) continue;
			// `headers: HEADERS` — resolve the constant in this file.
			const ident = call.match(HEADERS_IDENT)?.[1];
			if (ident) {
				const decl = source.match(new RegExp(`(?:const|let|var)\\s+${ident}\\s*=([^;]*);`));
				if (decl && CARRIES_HEADER.test(decl[1])) continue;
			}
			const line = source.slice(0, match.index).split('\n').length;
			offenders.push(`${relative}:${line} — ${url}`);
		}
	}
	return offenders;
}

describe('csrf transport gate', () => {
	it('no client code calls a mutating /api/ route with bare fetch', () => {
		expect(findBareMutatingFetches()).toEqual([]);
	});

	it('the matcher actually fires (guards against a silently dead regex)', () => {
		const sample = `await fetch('/api/desk/theme', { method: 'PUT', body: x });`;
		const hit = [...sample.matchAll(FETCH_CALL)];
		expect(hit).toHaveLength(1);
		expect(MUTATING_METHOD.test(sample)).toBe(true);
	});

	it('does not flag apiFetch', () => {
		const sample = `await apiFetch('/api/desk/theme', { method: 'PATCH' });`;
		expect([...sample.matchAll(FETCH_CALL)]).toHaveLength(0);
	});

	it('does not flag a non-mutating bare fetch', () => {
		const sample = `const r = await fetch('/api/blog/posts');`;
		const hit = [...sample.matchAll(FETCH_CALL)];
		expect(hit).toHaveLength(1);
		expect(MUTATING_METHOD.test(callText(sample, hit[0].index))).toBe(false);
	});

	it('a GET is not tainted by a mutating call that follows it', () => {
		const sample = [`const a = await fetch('/api/ai/conversations/x');`, `await other('/y', { method: 'POST' });`].join(
			'\n',
		);
		const hit = [...sample.matchAll(FETCH_CALL)];
		expect(MUTATING_METHOD.test(callText(sample, hit[0].index))).toBe(false);
	});

	it('accepts a manually-set header and a header constant', () => {
		const inline = `fetch('/api/x', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });`;
		expect(CARRIES_HEADER.test(inline)).toBe(true);
		const spread = `fetch('/api/x', { method: 'POST', headers: { ...CSRF_HEADER } });`;
		expect(CARRIES_HEADER.test(spread)).toBe(true);
	});
});
