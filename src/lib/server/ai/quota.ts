import { getProviderUsageToday } from '$lib/server/db/ai/admin-queries';
import { type LimitConfidence, PROVIDER_LIMITS, type ResetKind } from './provider-limits';
import { readProviderRedisUsage } from './provider-usage';
import { buildProviderRegistry, getCooldownResumeAt } from './providers';

/**
 * Single source of truth for the admin "Provider Resources & Limits" board.
 *
 * Reconciles three inputs into one serializable shape consumed by BOTH the page
 * `load()` (SSR first-paint) and `GET /api/admin/ai/quota` (live poll), so the
 * contract can't drift between them:
 *   - documented ceilings      → static `PROVIDER_LIMITS` (rots; carries verifiedOn)
 *   - observed requests/tokens  → SQL over `conversation_step` (today, UTC; lower bound)
 *   - 429s + embedding calls    → Redis counters (signals the SQL aggregate can't see)
 *   - availability             → the Redis-backed circuit breaker
 *
 * HONESTY: usage is never presented as exact. `requestsToday` is a lower bound
 * (shared key, failed calls, embeddings on a separate path), so `remaining` is an
 * upper bound and `usageSource` is 'estimated' whenever we have any count.
 */

export type UsageSource = 'estimated' | 'unknown';

export interface ProviderQuota {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	// ── Documented limits (static config) ──
	rpd: number | null;
	rpm: number | null;
	tpm: number | null;
	rpdConfidence: LimitConfidence;
	resetKind: ResetKind;
	resetTimezone: string | null;
	/** Next reset boundary as an absolute ISO instant (fixed-daily only), else null. */
	resetAt: string | null;
	verifiedOn: string;
	sourceUrl: string;
	note?: string;
	// ── Observed usage today (our own, lower bound) ──
	requestsToday: number;
	tokensToday: number;
	/** Embedding API calls today (Google only; 0 elsewhere) — the hidden Gemini load. */
	embeddingsToday: number;
	/** Rate-limit (429) hits today. */
	rateLimitedToday: number;
	usageSource: UsageSource;
	/** Estimated remaining requests (rpd − requests − embeddings), null when rpd unknown. */
	remaining: number | null;
	// ── Availability (Redis-backed circuit breaker) ──
	cooledDown: boolean;
	cooldownUntil: string | null;
}

/** Next wall-clock midnight in an IANA timezone, as an absolute ISO instant. */
function nextMidnightInTz(timeZone: string): string {
	const now = new Date();
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(now);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
	const hour = get('hour') % 24; // some impls report 24 at midnight
	const secondsIntoDay = hour * 3600 + get('minute') * 60 + get('second');
	const secondsUntilMidnight = 86_400 - secondsIntoDay;
	return new Date(now.getTime() + secondsUntilMidnight * 1000).toISOString();
}

/** Assemble the per-provider quota board. Never throws on a Redis/limit miss. */
export async function buildProviderQuota(): Promise<ProviderQuota[]> {
	const registry = buildProviderRegistry();
	const usageRows = await getProviderUsageToday();
	const usageByProvider = new Map(usageRows.map((r) => [r.provider, r]));

	return Promise.all(
		registry.map(async (p): Promise<ProviderQuota> => {
			const limit = PROVIDER_LIMITS[p.id];
			const sqlUsage = usageByProvider.get(p.id);
			const redisUsage = await readProviderRedisUsage(p.id);
			const cooldownUntil = await getCooldownResumeAt(p.id);

			const requestsToday = sqlUsage?.requests ?? 0;
			const rpd = limit?.rpd ?? null;
			const resetAt =
				limit && limit.resetKind === 'fixed-daily' && limit.resetTimezone
					? nextMidnightInTz(limit.resetTimezone)
					: null;
			// Headroom subtracts both chat requests and embedding calls (same key).
			const remaining = rpd === null ? null : Math.max(0, rpd - requestsToday - redisUsage.embeddings);

			return {
				id: p.id,
				name: p.name,
				configured: p.configured,
				model: p.model,
				rpd,
				rpm: limit?.rpm ?? null,
				tpm: limit?.tpm ?? null,
				rpdConfidence: limit?.rpdConfidence ?? 'unknown',
				resetKind: limit?.resetKind ?? 'unknown',
				resetTimezone: limit?.resetTimezone ?? null,
				resetAt,
				verifiedOn: limit?.verifiedOn ?? '',
				sourceUrl: limit?.sourceUrl ?? '',
				note: limit?.note,
				requestsToday,
				tokensToday: sqlUsage?.tokens ?? 0,
				embeddingsToday: redisUsage.embeddings,
				rateLimitedToday: redisUsage.rateLimited,
				usageSource: limit ? 'estimated' : 'unknown',
				remaining,
				cooledDown: cooldownUntil !== null,
				cooldownUntil,
			};
		}),
	);
}
