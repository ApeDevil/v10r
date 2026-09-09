/**
 * Leak gate for the AI-surface showcase — modeled on `showcases/auth/leak-gate.test.ts`.
 *
 * Scans the client-bundled showcase modules (`$lib/showcases/ai`) and the public route
 * tree (`showcases/ai/**`) for anything that must never reach a public page:
 * server imports, prompt bodies, abuse thresholds, real UUIDs, real emails.
 * Also asserts the zero-server invariant: no `+page.server.ts` anywhere under
 * `showcases/ai/` — both pages render entirely from client-safe projections.
 *
 * ── Why each root is asserted separately ─────────────────────────────────────
 *
 * This gate spent its life scanning `src/lib/showcase/ai` — singular, a directory
 * that has never existed. `walk()` threw ENOENT, the per-root catch swallowed it,
 * and the whole `$lib/showcases/ai` tree went unscanned: `topology.ts`, `replay.ts`
 * and the five recorded-turn fixtures, i.e. exactly the modules most likely to
 * carry a prompt constant. A single `files.length > 0` sentinel could not catch
 * that — the *other* root satisfied it. Non-emptiness is therefore asserted per
 * root, so one vanished root fails loudly instead of being covered for.
 *
 * Offenders are collected and asserted once rather than emitting an `it()` per
 * file: the rule count is what matters, and a failure should name every offending
 * path on one line instead of scrolling past a hundred green rows.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = [
	{ label: '$lib/showcases/ai', dir: join(process.cwd(), 'src/lib/showcases/ai') },
	{ label: 'routes showcases/ai', dir: join(process.cwd(), 'src/routes/[[locale=locale]]/(public)/showcases/ai') },
];

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

/** Scanned files per root, so a root that scans nothing can be named. */
const scanned = SCAN_ROOTS.map(({ label, dir }) => ({
	label,
	files: walk(dir).filter((f) => (f.endsWith('.ts') || f.endsWith('.svelte')) && !f.endsWith('.test.ts')),
}));

const files = scanned.flatMap((r) => r.files);
const rel = (f: string) => f.replace(process.cwd(), '.');

const FORBIDDEN: { label: string; re: RegExp }[] = [
	// Import syntax only — fixture ANSWER TEXT may legitimately mention the path
	// (the recorded turn teaches the leak-gate pattern itself).
	{ label: 'server import ($lib/server)', re: /(?:from\s+['"]|import\s*\(\s*['"])\$lib\/server\b/ },
	{ label: 'prompt body constant', re: /\b(SYSTEM_PROMPT|DESK_SYSTEM_PROMPT|COMPLETION_BLOCK|PLANNING_BLOCK)\s*[,)=]/ },
	{ label: 'abuse threshold', re: /\b(RATE_LIMIT_MAX|RATE_LIMIT_WINDOW|DAILY_TOKEN_CAP)\b/ },
	{
		label: 'real UUID (fixtures must use demo_ ids)',
		re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
	},
	{ label: 'personal email', re: /stas-k@gmx\.de/ },
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const sources = files.map((file) => ({ file, source: readFileSync(file, 'utf8') }));

describe('ai showcase leak gate', () => {
	// walk() is deliberately NOT wrapped in try/catch: a missing root must throw at
	// collection time. It is the swallowed ENOENT that hid this gate's own bug.
	it.each(scanned)('scans a non-empty tree under $label', ({ files: found }) => {
		expect(found.length).toBeGreaterThan(0);
	});

	it('has zero +page.server.ts under showcases/ai — both pages are zero-server', () => {
		const serverFiles = files.filter((f) => f.endsWith('+page.server.ts') || f.endsWith('+layout.server.ts'));
		expect(serverFiles.map(rel)).toEqual([]);
	});

	it.each(FORBIDDEN)('no client-bundled file contains a $label', ({ re }) => {
		const offenders = sources.filter(({ source }) => re.test(source)).map(({ file }) => rel(file));
		expect(offenders).toEqual([]);
	});

	it('every email in a scanned file is @example.com', () => {
		const offenders = sources.flatMap(({ file, source }) =>
			[...source.matchAll(EMAIL_RE)]
				.map((m) => m[0])
				.filter((email) => !email.endsWith('@example.com'))
				.map((email) => `${rel(file)} — ${email}`),
		);
		expect(offenders).toEqual([]);
	});

	it('the matchers actually fire (guards against a silently dead regex)', () => {
		const bait = [
			`import { x } from '$lib/server/ai/config';`,
			`const SYSTEM_PROMPT = 'you are';`,
			`if (n > RATE_LIMIT_MAX) return;`,
			`const id = '550e8400-e29b-41d4-a716-446655440000';`,
			`contact stas-k@gmx.de`,
		];
		expect(FORBIDDEN.map(({ re }, i) => re.test(bait[i]))).toEqual([true, true, true, true, true]);
		expect([...'a@evil.com'.matchAll(EMAIL_RE)].map((m) => m[0])).toEqual(['a@evil.com']);
	});
});
