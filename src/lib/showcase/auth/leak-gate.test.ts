/**
 * LEAK-GATE — fails the build if the public Identity & Access showcase
 * route tree ever regains a server attack surface or leaks an identifier.
 *
 * The auth showcase is `(public)`, has no `+page.server.ts`, and must
 * never import `$lib/server/*` nor render real secrets/PII. This test is
 * the durable enforcement so the self-documenting architecture cannot
 * silently re-introduce the leaks the redesign removed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AUTH_SHOWCASE_DIR = join(process.cwd(), 'src/routes/[[locale=locale]]/(public)/showcases/auth');

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const FORBIDDEN: { label: string; re: RegExp }[] = [
	{ label: '$lib/server import (server attack surface)', re: /\$lib\/server\b/ },
	{ label: 'betterAuthVersion disclosure', re: /betterAuthVersion/ },
	{ label: 'BETTER_AUTH_URL / SECRET', re: /BETTER_AUTH_(URL|SECRET)/ },
	{ label: 'ADMIN_EMAIL / ADMIN_USER_ID', re: /ADMIN_(EMAIL|USER_ID)/ },
	{ label: 'hardcoded personal email', re: /stas-k@gmx\.de/ },
	{
		label: 'real UUID (fixtures use demo_ ids)',
		re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
	},
	{ label: 'better-auth schema import', re: /schema\/auth\/_better-auth/ },
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

describe('Identity & Access showcase leak-gate', () => {
	const files = walk(AUTH_SHOWCASE_DIR).filter((f) => f.endsWith('.svelte') || f.endsWith('.ts'));

	it('scans a non-empty route tree', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('has zero +page.server.ts (no server attack surface)', () => {
		const serverFiles = files.filter((f) => f.endsWith('+page.server.ts'));
		expect(serverFiles, `found server loaders: ${serverFiles.join(', ')}`).toEqual([]);
	});

	for (const file of files) {
		describe(file.replace(process.cwd(), '.'), () => {
			const src = readFileSync(file, 'utf8');

			for (const { label, re } of FORBIDDEN) {
				it(`must not contain: ${label}`, () => {
					expect(re.test(src), `matched ${re}`).toBe(false);
				});
			}

			it('only references @example.com emails', () => {
				const bad = (src.match(EMAIL_RE) ?? []).filter((e) => !e.endsWith('@example.com'));
				expect(bad, `non-example emails: ${bad.join(', ')}`).toEqual([]);
			});

			it('only references 192.0.2.x (TEST-NET-1) IPs', () => {
				const bad = (src.match(IPV4_RE) ?? []).filter((ip) => !ip.startsWith('192.0.2.'));
				expect(bad, `non-TEST-NET IPs: ${bad.join(', ')}`).toEqual([]);
			});
		});
	}
});
