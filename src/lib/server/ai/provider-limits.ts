/**
 * Documented provider rate-limit ceilings — hand-maintained reference data.
 *
 * ZERO IMPORTS by design: this is plain documentation that rots, edited by a
 * developer (not an admin UI), and must be importable without dragging the
 * provider SDKs / private env that `providers.ts` pulls in. Cross-reference
 * providers by string id, never by importing the registry.
 *
 * HONESTY: none of our providers expose a reliable "remaining quota" for our
 * key types, and the ceilings below change without notice (Google silently cut
 * the Gemini free tier ~250→~20 RPD in Dec 2025). Every number carries a
 * `verifiedOn` date + `sourceUrl` + a confidence flag so the UI can show
 * "documented / estimated / unknown" rather than a false-authoritative gauge.
 */

/** How a provider's daily quota resets. */
export type ResetKind = 'fixed-daily' | 'rolling' | 'unknown';

/** Confidence in a documented number — Gemini free-tier RPD is unstable/undocumented. */
export type LimitConfidence = 'documented' | 'estimated' | 'unknown';

export interface ProviderLimit {
	providerId: string;
	/** Requests per day ceiling, or null when there's no fixed daily cap (e.g. OpenAI rolling). */
	rpd: number | null;
	/** Requests per minute — often the *binding* constraint (Gemini free ≈ 10 RPM). */
	rpm: number | null;
	/** Tokens per minute, informational. */
	tpm: number | null;
	/** How the daily window resets. */
	resetKind: ResetKind;
	/** IANA timezone for a fixed-daily reset, or null for rolling/unknown. */
	resetTimezone: string | null;
	/** Confidence in `rpd` specifically — the most volatile number. */
	rpdConfidence: LimitConfidence;
	/** Source-of-truth doc URL for the next developer who edits this. */
	sourceUrl: string;
	/** ISO date these numbers were last verified against the provider docs. */
	verifiedOn: string;
	/** Caveat surfaced in the UI when the number is soft. */
	note?: string;
}

export const PROVIDER_LIMITS: Record<string, ProviderLimit> = {
	groq: {
		providerId: 'groq',
		rpd: 1000,
		rpm: 30,
		tpm: 12_000,
		resetKind: 'fixed-daily',
		resetTimezone: 'UTC',
		rpdConfidence: 'documented',
		sourceUrl: 'https://console.groq.com/docs/rate-limits',
		verifiedOn: '2026-06-04',
		note: 'Free/dev tier for llama-3.3-70b-versatile. Groq adjusts free-tier limits without notice; reset timezone is undocumented (assumed UTC).',
	},
	google: {
		providerId: 'google',
		rpd: 20,
		rpm: 10,
		tpm: 250_000,
		resetKind: 'fixed-daily',
		resetTimezone: 'America/Los_Angeles',
		rpdConfidence: 'estimated',
		sourceUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits',
		verifiedOn: '2026-06-04',
		note: 'gemini-2.5-flash free tier. RPD is undocumented and unstable (silently cut ~250→~20 in Dec 2025); RPM≈10 is usually the real wall. Embeddings (gemini-embedding-001) share this key and are counted separately. Treat all figures as an estimate.',
	},
	openai: {
		providerId: 'openai',
		rpd: null,
		rpm: 500,
		tpm: 200_000,
		resetKind: 'rolling',
		resetTimezone: null,
		rpdConfidence: 'documented',
		sourceUrl: 'https://platform.openai.com/docs/guides/rate-limits',
		verifiedOn: '2026-06-04',
		note: 'Tier-1 entry limits for gpt-4o-mini. No fixed daily cap (rolling 24h window); limits scale with account tier.',
	},
};
