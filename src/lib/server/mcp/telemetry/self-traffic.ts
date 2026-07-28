/**
 * Classify a caller as real external traffic or as something that must not inflate the KPIs.
 *
 * Nobody in the MCP ecosystem has solved this — there is no spec field, no header convention, and
 * no vendor default. The closest thing to a standard is OpenTelemetry's `user_agent.synthetic.type`
 * (`bot` | `test`), which is derived SERVER-SIDE from the User-Agent and needs no client
 * cooperation. That is the shape adopted here, widened with the two sources that actually matter
 * for this deployment.
 *
 * Classification happens at INGESTION and the result is stored NOT NULL. The tempting alternative —
 * filter at analysis time, the way some analytics products do — is an anti-pattern here: every
 * query that forgets the filter silently lies, and the whole point of this table is to stop the
 * dashboard lying about adoption.
 *
 * The four non-external sources, in rough order of how much traffic they would otherwise fake:
 *
 *  1. `preview`  — preview deployments share the PRODUCTION Neon database. This is the largest
 *                  contamination source and the easiest to forget, because it needs no client at all.
 *  2. `self`     — the operator's own curl/CI, proven by a secret header (see below).
 *  3. `test`     — automated runs and registry probes. MCP registries actively probe listed servers
 *                  and some offer an in-browser inspector, so a listed server receives real
 *                  JSON-RPC that is neither the operator nor an adopting consumer.
 *  4. `bot`      — generic crawlers, folded into `test` since the distinction changes no decision.
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
	/** `VERCEL_ENV`. Anything other than 'production' shares the prod database. */
	vercelEnv: string | undefined;
	/** The self-traffic secret, if configured. */
	selfSecret: string | undefined;
}

/**
 * Precedence is deliberate: `preview` outranks `self`, because a preview deployment is not
 * production traffic even when the operator is the one driving it, and the KPI strip must not be
 * able to count it either way.
 */
export function classifyTraffic({ headers, vercelEnv, selfSecret }: TrafficInput): McpTraffic {
	if (vercelEnv !== undefined && vercelEnv !== 'production') return 'preview';
	if (matchesSelfSecret(headers.get(SELF_TRAFFIC_HEADER), selfSecret)) return 'self';
	if (SYNTHETIC_UA_RE.test(headers.get('user-agent') ?? '')) return 'test';
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
