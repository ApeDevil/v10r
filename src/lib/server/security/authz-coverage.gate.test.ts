/**
 * AUTHZ COVERAGE GATE — every API endpoint must declare how it is protected.
 *
 * SvelteKit cannot gate a `+server.ts` by folder position: layouts do not run
 * for endpoints, so no amount of route nesting protects one. All ~99 endpoints
 * are therefore individually responsible, and before this test nothing asserted
 * which ones were guarded and which were deliberately public — a new unguarded
 * admin endpoint would have failed silently and forever.
 *
 * The rule: a route either references a recognised guard scheme, or it appears
 * in the allowlist WITH a reason. There is no third option, and the reason is
 * data rather than a comment so it shows up in review.
 *
 * Honest limits: this proves a symbol is *mentioned*, not that it is called on
 * every code path, before the sensitive work, or with the right arguments. It
 * is a regression net for the "somebody forgot entirely" failure, which is the
 * one that actually happens — not a substitute for reading the endpoint.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes', 'api');

/** Any of these in the file body means the route enforces something. */
const GUARD_PATTERNS: Array<{ scheme: string; re: RegExp }> = [
	{ scheme: 'session', re: /\bguardApiUser\b/ },
	{ scheme: 'blog-author', re: /\bguardApiBlogAuthor\b/ },
	{ scheme: 'admin', re: /\bguardApiAdmin\b/ },
	{ scheme: 'ai', re: /\bguardAiRequest\b/ },
	{ scheme: 'ownership', re: /\bguardPostOwnership\b|\bguardAssetOwnership\b/ },
	{ scheme: 'page-guard', re: /\brequireAdmin\b|\brequireAuth\b/ },
	{ scheme: 'bearer', re: /\bverifyAdminMcpBearer\b|\bCRON_SECRET\b/ },
	{ scheme: 'hmac', re: /TELEGRAM_WEBHOOK_SECRET/ },
	{ scheme: 'cookie-actor', re: /\bverifyOwnerCookie\b|\bclearOwnerCookie\b/ },
];

/**
 * Endpoints that are public on purpose. Each needs a reason someone can argue
 * with — "it's fine" is not a reason, and an entry going stale fails the test.
 */
const PUBLIC_ENDPOINTS: Record<string, string> = {
	'mcp/public/+server.ts': 'Read-only pattern registry. Origin-validated and rate-limited; exposes no user data.',
	'captcha/challenge/+server.ts': 'ALTCHA issuance must precede any session by definition.',
	'search/+server.ts': 'Searches published content only. Rate-limited and CDN-cacheable.',
	'search-index/[locale]/+server.ts': 'Prerendered static index of public titles.',
	'showcases/check-username/+server.ts': 'Fixed word list, no database access.',
	'analytics/journey/+server.ts': 'sendBeacon ingest; cannot set headers. Origin-checked and consent-gated.',
	'analytics/journey/collect/+server.ts': 'Same beacon contract as its parent, plus an allowlist and a limiter.',
	'analytics/stream/+server.ts': 'Synthetic demo data only; connection-capped.',
	'blog/assets/[id]/image/+server.ts': 'Public image proxy. Resolves only assets attached to published posts.',
	'blog/media/[...path]/+server.ts': 'Legacy key proxy. Same published-only resolution as the by-id proxy.',
	'style/pick/+server.ts':
		"Writes only the caller's own v10r_style cookie. The custom-palette (CP_) branch checks session and ownership inline.",
	'style/roll/+server.ts':
		"Randomises the caller's own style cookie. Rate-limited; DB persistence is best-effort for signed-in users only.",
};

function endpointFiles(): string[] {
	const entries = readdirSync(ROUTES_DIR, { recursive: true }) as string[];
	return entries.filter((e) => e.endsWith('+server.ts'));
}

function classify(source: string): string | null {
	for (const { scheme, re } of GUARD_PATTERNS) {
		if (re.test(source)) return scheme;
	}
	return null;
}

describe('authz coverage', () => {
	const files = endpointFiles();

	it('finds the endpoint tree (guards against a silently empty scan)', () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it('every endpoint is either guarded or allowlisted with a reason', () => {
		const unclassified: string[] = [];
		for (const rel of files) {
			const source = readFileSync(join(ROUTES_DIR, rel), 'utf8');
			if (classify(source)) continue;
			const reason = PUBLIC_ENDPOINTS[rel.split('\\').join('/')];
			if (!reason) unclassified.push(rel);
		}
		expect(
			unclassified,
			`Unclassified endpoint(s). Add a guard, or an allowlist entry in this file explaining why it is public:\n  ${unclassified.join('\n  ')}`,
		).toEqual([]);
	});

	it('every allowlist entry still exists and is still unguarded', () => {
		const present = new Set(files.map((f) => f.split('\\').join('/')));
		const stale: string[] = [];
		for (const rel of Object.keys(PUBLIC_ENDPOINTS)) {
			if (!present.has(rel)) {
				stale.push(`${rel} (no such endpoint — delete the entry)`);
				continue;
			}
			const scheme = classify(readFileSync(join(ROUTES_DIR, rel), 'utf8'));
			if (scheme) stale.push(`${rel} (now uses "${scheme}" — delete the entry)`);
		}
		expect(stale, `Stale allowlist entries:\n  ${stale.join('\n  ')}`).toEqual([]);
	});

	it('every allowlist reason is a real sentence, not a placeholder', () => {
		for (const [rel, reason] of Object.entries(PUBLIC_ENDPOINTS)) {
			expect(reason.length, `${rel}: reason too short to be meaningful`).toBeGreaterThan(25);
		}
	});
});
