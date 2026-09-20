/**
 * CSP SCRIPT-HASH GATE — the inline script in `app.html` must be the one `svelte.config.js`
 * allowlists.
 *
 * The theme-flash script is inline (no nonce: `/offline` is prerendered), so `script-src`
 * carries its sha256. Dev never enforces CSP, which is how a comment edit inside the
 * script on 2026-09-02 shipped a stale hash and blocked the script in production for
 * seventeen days before anyone noticed. This gate recomputes the hash from the source
 * the same way the config's recipe does, so the two cannot drift silently again.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function inlineScriptHash(): string {
	const html = readFileSync(join(ROOT, 'src/app.html'), 'utf8');
	const body = html.match(/<script[^>]*>(.*?)<\/script>/s)?.[1];
	if (body === undefined) throw new Error('src/app.html has no inline <script>');
	return `sha256-${createHash('sha256').update(body).digest('base64')}`;
}

function allowlistedHashes(): string[] {
	const config = readFileSync(join(ROOT, 'svelte.config.js'), 'utf8');
	const block = config.match(/'script-src':\s*\[([^\]]*)\]/s);
	if (!block) throw new Error('svelte.config.js has no script-src directive');
	return [...block[1].matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
}

describe('CSP script-src', () => {
	it('allowlists the hash of the inline script app.html actually ships', () => {
		expect(allowlistedHashes()).toEqual([inlineScriptHash()]);
	});
});
