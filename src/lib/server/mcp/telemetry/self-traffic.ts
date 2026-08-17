/**
 * Classify a caller as real external traffic or as something that must not inflate the KPIs.
 *
 * MCP has no spec field, header convention or vendor default for this. The shape here follows
 * OpenTelemetry's `user_agent.synthetic.type` (`bot` | `test`), which is derived SERVER-SIDE from
 * the User-Agent and needs no client cooperation, widened with the two sources that matter for
 * this deployment. What each lane means: `mcpTrafficEnum` in `schema/mcp/call-log.ts`.
 *
 * Classification happens at INGESTION and is stored NOT NULL. Filtering at analysis time instead
 * is an anti-pattern here: every query that forgets the filter silently lies, and the point of the
 * table is to stop the dashboard lying about adoption.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export type McpTraffic = 'external' | 'self' | 'preview' | 'test';

/** Header the operator's own tooling sends. Value is compared in constant time against a secret. */
export const SELF_TRAFFIC_HEADER = 'x-v10r-self';

/**
 * Clients that are tooling rather than adoption. Modelled on the analytics collector's bot regex,
 * but MCP-flavoured: the User-Agents here are HTTP clients and test runners, not search crawlers.
 *
 * No `g` flag — `.test()` on a global regex is stateful and would alternate results.
 */
const SYNTHETIC_UA_RE =
	/curl|wget|httpie|postman|insomnia|python-requests|go-http-client|java|okhttp|axios|undici|node-fetch|vitest|playwright|puppeteer|inspector|bot|crawler|spider|probe|monitor|uptime/i;

/**
 * Constant-time compare of the self-traffic header against the configured secret.
 *
 * Attribution only — this NEVER feeds an authorization decision. It answers "was this me", not
 * "who is this caller", and a wrong answer costs a mislabelled dashboard row, nothing more. Both
 * sides are hashed to a fixed length first so `timingSafeEqual` cannot throw on a length mismatch
 * and there is no length branch to leak.
 */
function matchesSelfSecret(presented: string | null, secret: string | undefined): boolean {
	if (!presented || !secret) return false;
	const a = createHash('sha256').update(presented).digest();
	const b = createHash('sha256').update(secret).digest();
	return timingSafeEqual(a, b);
}

export interface TrafficInput {
	headers: Headers;
	/**
	 * Which endpoint was called. Load-bearing, not decorative: the admin and private surfaces are
	 * bearer-authenticated, so they have no anonymous caller and `external` is not a value either
	 * can legitimately take. The database enforces that as `mcp_call_admin_not_external` /
	 * `mcp_call_private_not_external`, and this parameter is what makes the classifier incapable
	 * of violating them.
	 */
	surface: 'public' | 'admin' | 'private';
	/** `VERCEL_ENV`. Anything other than 'production' shares the prod database. */
	vercelEnv: string | undefined;
	/** The self-traffic secret, if configured. */
	selfSecret: string | undefined;
}

/**
 * Precedence is deliberate: `preview` outranks `self`, because a preview deployment is not
 * production traffic even when the operator is the one driving it, and the KPI strip must not be
 * able to count it either way.
 *
 * The admin fallback sits LAST so the two more specific answers still win: a preview deployment is
 * still `preview`, and an operator driving the admin endpoint from curl is still `test`. It catches
 * only the case that would otherwise be `external`.
 */
export function classifyTraffic({ headers, surface, vercelEnv, selfSecret }: TrafficInput): McpTraffic {
	if (vercelEnv !== undefined && vercelEnv !== 'production') return 'preview';
	if (matchesSelfSecret(headers.get(SELF_TRAFFIC_HEADER), selfSecret)) return 'self';
	if (SYNTHETIC_UA_RE.test(headers.get('user-agent') ?? '')) return 'test';
	// Reaching the admin or private surface at all costs the respective bearer token, so the caller
	// is the operator whether or not they sent the self header — MCP clients do not. Labelling that
	// `external` would inflate the adoption KPI AND violate the table's CHECKs, and since the writer
	// fails open the rows would be dropped silently. The precedence above still applies: an operator
	// curl against either surface classifies `test`, a preview deployment `preview` — both legal,
	// only `external` is forbidden, so lane queries filter on `surface`, never `traffic`.
	if (surface === 'admin' || surface === 'private') return 'self';
	return 'external';
}

/**
 * Bucket the User-Agent into a small, bounded family.
 *
 * Self-asserted and trivially spoofable, so this is a low-cardinality HINT for aggregate reading and
 * never an identity or an auth input. Ordered most-specific first: `claude-code` must be tested
 * before the generic `claude` so a CLI caller does not land in the web bucket.
 */
export function classifyClientFamily(userAgent: string | null): string {
	if (!userAgent) return 'none';
	const ua = userAgent.toLowerCase();
	if (ua.includes('claude-code')) return 'claude-code';
	if (ua.includes('claude-user') || ua.includes('claude-web')) return 'claude-web';
	if (ua.includes('claude')) return 'claude-desktop';
	if (ua.includes('cursor')) return 'cursor';
	if (ua.includes('windsurf')) return 'windsurf';
	if (ua.includes('vscode') || ua.includes('code/')) return 'vscode';
	if (ua.includes('inspector')) return 'inspector';
	if (ua.includes('modelcontextprotocol') || ua.includes('mcp-sdk')) return 'sdk';
	if (ua.includes('curl') || ua.includes('wget') || ua.includes('httpie')) return 'curl';
	if (SYNTHETIC_UA_RE.test(ua)) return 'bot';
	return 'other';
}
