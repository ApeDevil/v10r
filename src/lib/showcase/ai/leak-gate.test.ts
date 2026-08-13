/**
 * Leak gate for the AI-surface showcase — modeled on `showcase/auth/leak-gate.test.ts`.
 *
 * Scans the client-bundled showcase modules (this directory) and the public route
 * tree (`showcases/ai/**`) for anything that must never reach a public page:
 * server imports, prompt bodies, abuse thresholds, real UUIDs, real emails.
 * Also asserts the zero-server invariant: no `+page.server.ts` anywhere under
 * `showcases/ai/` — both pages render entirely from client-safe projections.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = [
	join(process.cwd(), 'src/lib/showcase/ai'),
	join(process.cwd(), 'src/routes/[[locale=locale]]/(public)/showcases/ai'),
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

const files = SCAN_ROOTS.flatMap((root) => {
	try {
		return walk(root);
	} catch {
		return [];
	}
}).filter((f) => (f.endsWith('.ts') || f.endsWith('.svelte')) && !f.endsWith('.test.ts'));

const FORBIDDEN: { label: string; re: RegExp }[] = [
	// Import syntax only — fixture ANSWER TEXT may legitimately mention the path
	// (the recorded turn teaches the leak-gate pattern itself).
	{ label: 'server import ($lib/server)', re: /(?:from\s+['"]|import\s*\(\s*['"])\$lib\/server\b/ },
	{ label: 'prompt body constant', re: /\b(SYSTEM_PROMPT|DESK_SYSTEM_PROMPT|COMPLETION_BLOCK|PLANNING_BLOCK)\s*[,)=]/ },
	{ label: 'abuse threshold', re: /\b(RATE_LIMIT_MAX|RATE_LIMIT_WINDOW|AI_DAILY_TOKEN_CAP)\b/ },
	{
		label: 'real UUID (fixtures must use demo_ ids)',
		re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
	},
	{ label: 'personal email', re: /stas-k@gmx\.de/ },
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

describe('ai showcase leak gate', () => {
	it('scans a non-empty tree (moved directory would pass vacuously)', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('has zero +page.server.ts under showcases/ai — both pages are zero-server', () => {
		const serverFiles = files.filter((f) => f.endsWith('+page.server.ts') || f.endsWith('+layout.server.ts'));
		expect(serverFiles.map((f) => f.replace(process.cwd(), '.'))).toEqual([]);
	});

	for (const file of files) {
		describe(file.replace(process.cwd(), '.'), () => {
			const source = readFileSync(file, 'utf8');
			for (const { label, re } of FORBIDDEN) {
				it(`contains no ${label}`, () => {
					expect(source).not.toMatch(re);
				});
			}
			it('uses only @example.com emails', () => {
				for (const match of source.matchAll(EMAIL_RE)) {
					expect(match[0].endsWith('@example.com'), match[0]).toBe(true);
				}
			});
		});
	}
});
