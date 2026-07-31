/**
 * AUTHZ COVERAGE GATE — every server-side entry point must declare how it is protected.
 *
 * SvelteKit cannot gate a `+server.ts` by folder position: layouts do not run
 * for endpoints, so no amount of route nesting protects one. Form actions in
 * `+page.server.ts` are the same — a `+layout.server.ts` load does not run
 * before an action. Every one of these files is individually responsible.
 *
 * The rule: a surface either references a recognised guard scheme, or it appears
 * in an allowlist WITH a reason. There is no third option, and the reason is
 * data rather than a comment so it shows up in review.
 *
 * ── Why there are two scans ──────────────────────────────────────────────────
 *
 * This gate used to scan `src/routes/api` for `+server.ts` and nothing else. It
 * was therefore structurally blind to the exact class of surface an
 * unauthenticated arbitrary-object read shipped in: a public `+page.server.ts`
 * form action, which is neither under `/api` nor named `+server.ts`. Fifty-three
 * files exporting `actions`, plus eleven `+server.ts` outside `/api`, were
 * invisible — and one `+page.server.ts` sits INSIDE `src/routes/api`, so it was
 * in the scanned tree and still unseen.
 *
 * The two scans keep separate allowlists because their keys are relative to
 * different roots. Merging them would silently invalidate all twelve existing
 * `/api` entries at once.
 *
 * ── Honest limits ────────────────────────────────────────────────────────────
 *
 * This proves a symbol is *mentioned*, not that it is called on every code path,
 * before the sensitive work, or with the right arguments. It is a regression net
 * for the "somebody forgot entirely" failure, which is the one that actually
 * happens — not a substitute for reading the endpoint.
 *
 * `+server.ts` files are classified per exported method, so a guarded `GET`
 * beside an unguarded `DELETE` no longer passes on the strength of its
 * neighbour. A guard token in the module preamble still counts for every method
 * in that file, because a shared helper defined at module scope is the normal
 * way to write this and flagging it would be a false positive.
 *
 * Form actions are classified per FILE, not per action. A file with a guarded
 * `save` and an unguarded `delete` still passes. Closing that needs a real parse
 * of the `actions` object literal; it is recorded here as a known gap rather
 * than half-implemented.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const API_DIR = join(ROUTES_DIR, 'api');

/** Any of these in the source means the surface enforces something. */
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
	/**
	 * An inline session check. Many surfaces are in fact guarded this way and were
	 * invisible to this gate because they call no named helper.
	 *
	 * Deliberately matches the REJECTION shape `if (!locals.user)`, not a bare
	 * mention of `locals.user`. Plenty of public routes read the session to
	 * personalise a response — `style/roll` persists a preference when someone
	 * happens to be signed in — and crediting that as authorization would hand
	 * out coverage no one enforces. "Refuses without a session" is a claim; "knows
	 * whether there is a session" is not.
	 */
	{ scheme: 'inline-session', re: /if\s*\(\s*!\s*locals\.(user|session)\b/ },
	/**
	 * A storage-namespace assertion. This is the scheme whose ABSENCE let an
	 * unauthenticated arbitrary-object read reach every key in a shared bucket:
	 * the route took a caller-supplied key and handed it to S3 with nothing in
	 * between. A surface that pins the key namespace is guarded even though no
	 * session is involved, because the authority being checked is the object's,
	 * not the caller's.
	 */
	{ scheme: 'namespace-guard', re: /\bassert(Showcase|Blog|Image|Imagemeta|Imagekit|Avatar)Key\b/ },
];

/**
 * `/api` endpoints that are public on purpose. Keys are relative to
 * `src/routes/api`. Each needs a reason someone can argue with — "it's fine" is
 * not a reason, and an entry going stale fails the test.
 */
const PUBLIC_ENDPOINTS: Record<string, string> = {
	'mcp/public/+server.ts': 'Read-only pattern registry. Origin-validated and rate-limited; exposes no user data.',
	'captcha/challenge/+server.ts': 'ALTCHA issuance must precede any session by definition.',
	'search/+server.ts': 'Searches published content only. Rate-limited and CDN-cacheable.',
	'search-index/[locale]/+server.ts': 'Prerendered static index of public titles.',
	'showcases/check-username/+server.ts': 'Fixed word list, no database access.',
	'analytics/journey/+server.ts': 'sendBeacon ingest; cannot set headers. Origin-checked, consent-gated, rate-limited.',
	'analytics/journey/collect/+server.ts': 'Same beacon contract as its parent, plus an allowlist and a limiter.',
	'analytics/stream/+server.ts': 'Synthetic demo data only; connection-capped.',
	'blog/assets/[id]/image/+server.ts': 'Public image proxy. Resolves only assets attached to published posts.',
	'blog/media/[...path]/+server.ts': 'Legacy key proxy. Same published-only resolution as the by-id proxy.',
	'style/pick/+server.ts':
		"Writes only the caller's own v10r_style cookie. The custom-palette (CP_) branch checks session and ownership inline.",
	'style/roll/+server.ts':
		"Randomises the caller's own style cookie. Rate-limited; DB persistence is best-effort for signed-in users only.",
	'mcp/admin/+server.ts':
		'GET only. Streamable HTTP makes the SSE channel optional and this one is unconditionally 405 — no auth, no tool metadata, no body — so bearer guessing has no path outside the rate-limited POST. The POST is bearer-guarded.',
	'blog/posts/[id]/comments/+server.ts':
		"GET only; the POST is session-guarded. Lists non-deleted, status='visible' comments, and reads locals.user?.id solely to surface the caller's own pending ones. It does not verify the post is published, so visible comments on a draft are readable by post id — narrow, but real.",
};

/**
 * Form actions and non-`/api` endpoints that are public on purpose. Keys are
 * relative to `src/routes`.
 *
 * Most are showcase demos, and "it's a demo" is deliberately NOT accepted as a
 * reason on its own — a public demo writing to a shared backing store is
 * precisely how the arbitrary-object read shipped. Each entry says what the
 * surface can actually reach.
 */
const PUBLIC_SURFACES: Record<string, string> = {
	// ── Non-/api endpoints ────────────────────────────────────────────────────
	'[[locale=locale]]/(dev)/llmwiki-probe/+server.ts':
		'Dev-only probe: devRouteGuard 404s any /(dev)/ route outside import.meta.env.DEV, so it does not exist in production. It reads an arbitrary userId from the query string and must never be given a production route.',
	'[[locale=locale]]/(public)/blog/feed.xml/+server.ts':
		'Public RSS feed. Reads listPublishedPostsForFeed, so drafts are unreachable by construction.',
	'llms.txt/+server.ts':
		'Agent-facing URL map built from the published docs manifest only — blocked and draft docs are unreachable because it never touches the raw glob. Same published-only resolution as the sitemap.',
	'manifest.webmanifest/+server.ts': 'Static PWA manifest. No data access; locale read from the request cookie.',
	'robots.txt/+server.ts': 'Static, environment-aware robots policy. No data access.',
	'sitemap.xml/+server.ts': 'Public URL index over published content only, same resolution as the feed.',

	// ── Consent ───────────────────────────────────────────────────────────────
	'api/consent/+page.server.ts':
		'Records a consent grant or withdrawal for an anonymous visitor. Requiring a session would be incoherent — the point is that the subject is not identified — and it writes only a keyed visitor hash.',

	// ── Pairing claim ─────────────────────────────────────────────────────────
	'[[locale=locale]]/pair/[code]/+page.server.ts':
		'Phone-side claim of a single-use admin pairing code — the phone has no session by definition, so the code itself is the credential (8^6 keyspace, 10-min TTL, 5-attempt cap, atomic claim). The POST action is IP-rate-limited before any DB round-trip; the load is read-only format validation.',

	// ── Public feedback ───────────────────────────────────────────────────────
	'[[locale=locale]]/(public)/feedback/+page.server.ts':
		'Anonymous feedback submission — requiring a session would defeat the purpose. Rate-limited per /64, and it writes only to the feedback table. It reads locals.user solely to prefill the contact email for signed-in visitors, which is not a check.',

	// ── Showcase: forms ───────────────────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/forms/basics/contact/+page.server.ts':
		'Validation demo. Superforms parses and returns; nothing is persisted and no message is sent.',
	'[[locale=locale]]/(public)/showcases/forms/basics/settings/+page.server.ts':
		'Validation demo over an in-memory object. No database, no cookie, no effect outliving the response.',
	'[[locale=locale]]/(public)/showcases/forms/validation/server/+page.server.ts':
		'Demonstrates server-side validation failure shapes. Returns fail() with issues; writes nothing.',
	'[[locale=locale]]/(public)/showcases/forms/validation/async/+page.server.ts':
		'Demonstrates an async validator with an artificial delay. No persistence and no external call.',
	'[[locale=locale]]/(public)/showcases/forms/validation/realtime/+page.server.ts':
		'Mirrors the client-side realtime validator on the server. Pure validation, no writes.',
	'[[locale=locale]]/(public)/showcases/forms/patterns/dependent/+page.server.ts':
		'Dependent-field demo over a static option table. No writes and no user data.',
	'[[locale=locale]]/(public)/showcases/forms/patterns/dynamic/+page.server.ts':
		'Dynamic add/remove rows demo. State lives in the form payload only; nothing is stored.',
	'[[locale=locale]]/(public)/showcases/forms/patterns/wizard/+page.server.ts':
		'Multi-step wizard demo. Step state round-trips through the form; no server-side session is created.',
	'[[locale=locale]]/(public)/showcases/forms/advanced/edit/+page.server.ts':
		'Edit-form demo over a fixture record. Returns the mutated shape without persisting it.',
	'[[locale=locale]]/(public)/showcases/forms/advanced/confirm/+page.server.ts':
		'Confirmation-dialog demo. The destructive action is simulated and touches no store.',
	'[[locale=locale]]/(public)/showcases/forms/advanced/reset/+page.server.ts':
		'Form-reset demo. Returns a fresh default form; writes nothing anywhere.',

	// ── Showcase: cycle ───────────────────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/cycle/api/+page.server.ts':
		'Illustrates the request/response cycle by echoing timing back to the page. No persistence.',
	'[[locale=locale]]/(public)/showcases/cycle/form/+page.server.ts':
		'Illustrates progressive enhancement with and without JS. Echoes the submission; stores nothing.',
	'[[locale=locale]]/(public)/showcases/cycle/ai/+page.server.ts':
		'Request-cycle trace demo. Reads locals.user only to label the trace, falling back to "anonymous"; the AI call it drives is budget-guarded downstream.',

	// ── Showcase: analytics ───────────────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/analytics/overview/+page.server.ts':
		'Reads aggregate analytics counters that are public by design. No per-visitor rows and no writes.',

	// ── Showcase: cache ───────────────────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/db/cache/connection/+page.server.ts':
		'Pings Redis and reports reachability. Reads server-chosen diagnostic keys only.',
	'[[locale=locale]]/(public)/showcases/db/cache/ephemeral/+page.server.ts':
		'TTL and rate-limit demo. Keys are namespaced under the showcase prefix, and the limiter bucket is the caller own /64 rather than a value taken from the form.',
	'[[locale=locale]]/(public)/showcases/db/cache/patterns/+page.server.ts':
		'Cache-aside and write-through demos, confined to the showcase key namespace.',

	// ── Showcase: graph / relational ──────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/db/graph/connection/+page.server.ts':
		'Reports Neo4j reachability with a fixed probe query. Takes no caller-supplied Cypher.',
	'[[locale=locale]]/(public)/showcases/db/relational/connection/+page.server.ts':
		'Reports Postgres reachability with a fixed probe. No caller-supplied SQL.',
	'[[locale=locale]]/(public)/showcases/db/relational/types/+page.server.ts':
		'Round-trips Postgres column types through a dedicated showcase table. No other schema is reachable.',
	'[[locale=locale]]/(public)/showcases/db/relational/mutability/+page.server.ts':
		'Insert/update/delete demo confined to the showcase table, which the reseed action rebuilds.',
	'[[locale=locale]]/(public)/showcases/db/graph/model/+page.server.ts':
		'Read-only graph model viewer. The one mutating action, reseed, rejects non-admins inline with isAdmin(locals.user); everything else runs fixed read queries.',
	'[[locale=locale]]/(public)/showcases/db/graph/traversal/+page.server.ts':
		'browse, shortestPath and recommend run parameterised read-only traversals and are public by design. Only repl accepts arbitrary Cypher, and it rejects non-admins inline with isAdmin(locals.user).',

	// ── Showcase: storage ─────────────────────────────────────────────────────
	'[[locale=locale]]/(public)/showcases/db/storage/connection/+page.server.ts':
		'Reports R2 reachability and counts objects under the public showcase prefix only.',
	'[[locale=locale]]/(public)/showcases/db/storage/objects/+page.server.ts':
		'Anonymous upload and listing demo. Every key path goes through assertShowcaseKey, which pins the public showcase namespace and refuses the private per-user prefixes sharing it.',
	'[[locale=locale]]/(public)/showcases/db/storage/transfer/+page.server.ts':
		'Presigned-URL and ranged-read demo. Keys go through assertShowcaseKey; the TTL and the byte range are both clamped server-side.',
};

const METHOD_RE = /^export\s+(?:const|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/gm;

/**
 * Import statements, including multi-line ones. Stripped from the preamble
 * before it is carried.
 *
 * Without this the split was decorative: every file imports the guard it uses,
 * so `import { guardApiUser }` sat in the preamble of an unguarded `DELETE` and
 * classified it `session`. That is precisely the "guarded GET vouches for its
 * unguarded neighbour" blindness the per-method split exists to close, re-opened
 * one line above the handlers. An import is evidence of nothing being called.
 */
const IMPORT_STATEMENT_RE = /^import\b[^;]*;/gm;

/**
 * Split a `+server.ts` into one unit per exported HTTP method, each prefixed
 * with the module preamble (imports removed).
 *
 * Carrying the rest of the preamble is deliberate: a guard reached through a
 * helper defined at module scope is normal, and flagging it would be a false
 * positive. What this does catch is the real failure — one handler consulting a
 * guard while its neighbour in the same file consults nothing.
 */
function methodUnits(source: string): Array<{ method: string; source: string }> {
	const matches = [...source.matchAll(METHOD_RE)];
	if (matches.length === 0) return [{ method: '(module)', source }];
	const preamble = source.slice(0, matches[0].index).replace(IMPORT_STATEMENT_RE, '');
	return matches.map((match, index) => {
		const start = match.index;
		const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
		return { method: match[1], source: preamble + source.slice(start, end) };
	});
}

function classify(source: string): string | null {
	for (const { scheme, re } of GUARD_PATTERNS) {
		if (re.test(source)) return scheme;
	}
	return null;
}

function normalize(relative: string): string {
	return relative.split('\\').join('/');
}

function filesUnder(dir: string, predicate: (relative: string) => boolean): string[] {
	return (readdirSync(dir, { recursive: true }) as string[]).map(normalize).filter(predicate);
}

/** Endpoints under `src/routes/api`. */
function apiEndpoints(): string[] {
	return filesUnder(API_DIR, (relative) => relative.endsWith('+server.ts'));
}

/**
 * Everything the original scan could not see: form actions anywhere under
 * `src/routes` (including inside `api/`), plus endpoints outside `api/`.
 */
function otherSurfaces(): string[] {
	return filesUnder(ROUTES_DIR, (relative) => {
		if (relative.endsWith('+page.server.ts')) {
			return /^export const actions/m.test(readFileSync(join(ROUTES_DIR, relative), 'utf8'));
		}
		return relative.endsWith('+server.ts') && !relative.startsWith('api/');
	});
}

/** Report every method in `relative` that references no guard scheme. */
function unguardedMethods(root: string, relative: string): string[] {
	const source = readFileSync(join(root, relative), 'utf8');
	// Form actions are classified per file — see the honest-limits note above.
	if (relative.endsWith('+page.server.ts')) return classify(source) ? [] : ['(actions)'];
	return methodUnits(source)
		.filter((unit) => classify(unit.source) === null)
		.map((unit) => unit.method);
}

function auditScan(root: string, files: string[], allowlist: Record<string, string>): string[] {
	const unclassified: string[] = [];
	for (const relative of files) {
		const unguarded = unguardedMethods(root, relative);
		if (unguarded.length === 0) continue;
		if (allowlist[relative]) continue;
		unclassified.push(`${relative} [${unguarded.join(', ')}]`);
	}
	return unclassified;
}

/**
 * Schemes that gate a WHOLE surface. `inline-session` and `namespace-guard` are
 * deliberately excluded: both are branch-level.
 *
 * `style/pick` is the case that makes this necessary. It is a public endpoint —
 * anyone may set their own style cookie — but its custom-palette branch rejects
 * with `if (!locals.user)`. That is a real check on one path, and it is exactly
 * what the allowlist entry already says. Treating it as whole-surface coverage
 * would delete the note explaining why the OTHER path is public, and replace it
 * with coverage nobody enforces.
 */
const SURFACE_LEVEL_SCHEMES = GUARD_PATTERNS.filter(
	({ scheme }) => scheme !== 'inline-session' && scheme !== 'namespace-guard',
);

function hasSurfaceLevelGuard(source: string): boolean {
	return SURFACE_LEVEL_SCHEMES.some(({ re }) => re.test(source));
}

/**
 * Methods carrying no whole-surface guard. An allowlist entry exists to explain
 * these, so it is stale exactly when there are none left.
 *
 * Asked per method, not per file. Two endpoints — the admin MCP surface and the
 * blog comment list — pair a guarded POST with a deliberately public GET. Asking
 * the question of the whole file would see the POST's guard, call the entry
 * stale, and demand deletion of the note explaining why the GET is public.
 */
function methodsWithoutSurfaceGuard(root: string, relative: string): string[] {
	const source = readFileSync(join(root, relative), 'utf8');
	if (relative.endsWith('+page.server.ts')) return hasSurfaceLevelGuard(source) ? [] : ['(actions)'];
	return methodUnits(source)
		.filter((unit) => !hasSurfaceLevelGuard(unit.source))
		.map((unit) => unit.method);
}

function auditAllowlist(root: string, files: string[], allowlist: Record<string, string>): string[] {
	const present = new Set(files);
	const stale: string[] = [];
	for (const relative of Object.keys(allowlist)) {
		if (!present.has(relative)) {
			stale.push(`${relative} (no such surface — delete the entry)`);
			continue;
		}
		if (methodsWithoutSurfaceGuard(root, relative).length === 0) {
			stale.push(`${relative} (every method now carries a whole-surface guard — delete the entry)`);
		}
	}
	return stale;
}

describe('authz coverage — /api endpoints', () => {
	const files = apiEndpoints();

	it('finds the endpoint tree (guards against a silently empty scan)', () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it('every endpoint method is either guarded or allowlisted with a reason', () => {
		const unclassified = auditScan(API_DIR, files, PUBLIC_ENDPOINTS);
		expect(
			unclassified,
			`Unclassified endpoint method(s). Add a guard, or an allowlist entry in this file explaining why it is public:\n  ${unclassified.join('\n  ')}`,
		).toEqual([]);
	});

	it('every allowlist entry still exists and is still unguarded', () => {
		const stale = auditAllowlist(API_DIR, files, PUBLIC_ENDPOINTS);
		expect(stale, `Stale allowlist entries:\n  ${stale.join('\n  ')}`).toEqual([]);
	});
});

describe('authz coverage — form actions and non-/api endpoints', () => {
	const files = otherSurfaces();

	it('finds the surfaces the /api scan cannot see', () => {
		// A sentinel with real teeth: this scan exists because 53 form actions and
		// 11 non-/api endpoints were invisible. A regression that empties it would
		// otherwise make every assertion below pass by having nothing to check.
		expect(files.filter((file) => file.endsWith('+page.server.ts')).length).toBeGreaterThan(40);
		expect(files.filter((file) => file.endsWith('+server.ts')).length).toBeGreaterThan(5);
	});

	it('includes a +page.server.ts that lives inside src/routes/api', () => {
		// The /api scan matches only +server.ts, so this one file sat inside the
		// scanned tree and was still unseen.
		expect(files).toContain('api/consent/+page.server.ts');
	});

	it('every form action and non-/api endpoint is guarded or allowlisted with a reason', () => {
		const unclassified = auditScan(ROUTES_DIR, files, PUBLIC_SURFACES);
		expect(
			unclassified,
			`Unclassified surface(s). Add a guard, or an allowlist entry in this file explaining why it is public:\n  ${unclassified.join('\n  ')}`,
		).toEqual([]);
	});

	it('every allowlist entry still exists and is still unguarded', () => {
		const stale = auditAllowlist(ROUTES_DIR, files, PUBLIC_SURFACES);
		expect(stale, `Stale allowlist entries:\n  ${stale.join('\n  ')}`).toEqual([]);
	});
});

describe('authz coverage — the gate itself', () => {
	it('every allowlist reason is a real sentence, not a placeholder', () => {
		for (const [relative, reason] of Object.entries({ ...PUBLIC_ENDPOINTS, ...PUBLIC_SURFACES })) {
			expect(reason.length, `${relative}: reason too short to be meaningful`).toBeGreaterThan(25);
		}
	});

	it('classifies each exported method separately', () => {
		// The blindness this replaces: one regex over the whole file body meant a
		// guarded GET vouched for an unguarded DELETE beside it.
		const source = [
			"import { guardApiUser } from '$lib/server/auth/guards';",
			'export const GET = async ({ locals }) => guardApiUser(locals);',
			'export const DELETE = async () => dropEverything();',
		].join('\n');
		const units = methodUnits(source);
		expect(units.map((unit) => unit.method)).toEqual(['GET', 'DELETE']);
		expect(classify(units[0].source)).toBe('session');
		expect(classify(units[1].source)).toBeNull();
	});

	it('does not let an IMPORT vouch for a method that never calls the guard', () => {
		// Without the import strip the per-method split was decorative: every real
		// file imports the guard it uses, so the symbol sat in the preamble of an
		// unguarded neighbour. Two endpoints were passing on exactly this.
		const source = [
			"import { guardApiUser } from '$lib/server/auth/guards';",
			'export const DELETE = async () => dropEverything();',
		].join('\n');
		expect(classify(methodUnits(source)[0].source)).toBeNull();
	});

	it('strips multi-line imports too — the formatter writes them that way', () => {
		const source = [
			'import {',
			'\tguardApiUser,',
			'\tguardApiAdmin,',
			"} from '$lib/server/auth/guards';",
			'export const DELETE = async () => dropEverything();',
		].join('\n');
		expect(classify(methodUnits(source)[0].source)).toBeNull();
	});

	it('lets a module-scope guard vouch for every method in its file', () => {
		const source = [
			'function readKey(key) { assertShowcaseKey(key); }',
			'export const GET = async () => read();',
			'export const POST = async () => write();',
		].join('\n');
		expect(methodUnits(source).every((unit) => classify(unit.source) === 'namespace-guard')).toBe(true);
	});

	it('recognises the namespace-guard scheme whose absence let SEC-N01 ship', () => {
		expect(classify('const detail = await getObjectDetail(key);')).toBeNull();
		expect(classify('assertShowcaseKey(key);\nconst detail = await getObjectDetail(key);')).toBe('namespace-guard');
	});
});
