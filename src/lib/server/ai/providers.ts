/**
 * Provider resolution — which connection serves a given turn — plus the AI domain's
 * breaker policy and the per-user preference.
 *
 * Every resolver takes the `ProviderRegistry` an operation loaded at its start (see
 * `index.ts`); nothing here reads configuration on its own, so one operation never sees
 * two different snapshots. Precedence is the same for all three resolvers:
 * explicit preference → the administrator's project default → the capability order.
 */

import { defineBreaker, resetBreakers } from '$lib/server/resilience';
import type { AiProviderId } from '$lib/types/db-enums';
import type { ProviderEntry, ProviderRegistry } from './connections';

function preferred(
	pool: ProviderEntry[],
	registry: ProviderRegistry,
	preference?: string | null,
): ProviderEntry | null {
	if (preference) {
		const match = pool.find((p) => p.id === preference);
		if (match) return match;
	}
	if (registry.defaultProviderId) {
		const match = pool.find((p) => p.id === registry.defaultProviderId);
		if (match) return match;
	}
	return null;
}

function firstOf(pool: ProviderEntry[], order: readonly AiProviderId[]): ProviderEntry | null {
	for (const id of order) {
		const match = pool.find((p) => p.id === id);
		if (match) return match;
	}
	return pool[0] ?? null;
}

/** Chat-only turns: preference → project default → first configured (registry order). */
export function resolveActiveProvider(registry: ProviderRegistry, preference?: string | null): ProviderEntry | null {
	const pool = registry.entries.filter((p) => p.configured);
	return preferred(pool, registry, preference) ?? pool[0] ?? null;
}

/** Other configured providers, for fallback rotation. */
export function getFallbackProviders(registry: ProviderRegistry, activeId: string): ProviderEntry[] {
	return registry.entries.filter((p) => p.configured && p.id !== activeId);
}

/**
 * Tool-calling turns: preference → project default → OpenAI > Google > others, over the
 * providers whose *model* is known to emit structured tool calls.
 */
export function resolveToolProvider(registry: ProviderRegistry, preference?: string | null): ProviderEntry | null {
	const pool = registry.entries.filter((p) => p.configured && p.capabilities.tools);
	return preferred(pool, registry, preference) ?? firstOf(pool, ['openai', 'google']);
}

/**
 * Image input: preference → project default → Google > OpenAI, over the providers whose
 * model accepts image parts.
 *
 * This filter is load-bearing: a text-only model would silently receive a blind image
 * and hallucinate. Image extraction MUST route through here, never through
 * resolveActiveProvider.
 */
export function resolveVisionProvider(registry: ProviderRegistry, preference?: string | null): ProviderEntry | null {
	const pool = registry.entries.filter((p) => p.configured && p.capabilities.vision);
	// Gemini first: cheaper + larger context + native multimodal.
	return preferred(pool, registry, preference) ?? firstOf(pool, ['google', 'openai']);
}

// Provider cooldown — this domain's use of the general circuit breaker.
//
// "Cooldown" stays the AI vocabulary because it is what the surfaces say (the admin
// models board, the desk provider list, the chat fallback log); `$lib/server/resilience`
// owns the mechanism, this owns the policy and the words.
//
// The breaker's shared-state and fallback behaviour is documented there — including
// why an unreadable Redis is treated as "still cooled" rather than "fine".

const providerBreaker = defineBreaker({
	name: 'ai-provider',
	openForSeconds: 60,
	// Governs `recordFailure`, which this domain does not call: a provider is cooled only
	// when it explicitly 429s, because a stream error is usually the request's fault
	// (bad tool schema, oversized context) and cooling the provider for it would take a
	// healthy provider out of rotation for everyone.
	failureThreshold: 3,
	failureWindowSeconds: 60,
});

/** Reset the in-memory fallback store. For test cleanup only (no-op against Redis). */
export function resetCooldowns(): void {
	resetBreakers();
}

/** Mark a provider as rate-limited for `durationMs` (default 60s). Non-blocking. */
export async function markCooldown(providerId: string, durationMs = 60_000): Promise<void> {
	await providerBreaker.trip(providerId, Math.ceil(durationMs / 1000));
}

/** Check if a provider is currently in cooldown. */
export async function isCooledDown(providerId: string): Promise<boolean> {
	return providerBreaker.isOpen(providerId);
}

/** Get the cooldown resume time as ISO string, or null if not cooled down. */
export async function getCooldownResumeAt(providerId: string): Promise<string | null> {
	const { retryAt } = await providerBreaker.state(providerId);
	return retryAt === null ? null : new Date(retryAt).toISOString();
}

// ── User provider preferences (in-memory, resets on server restart) ──
//
// A preference names a provider; whether it is honoured is decided at resolution time
// against the registry, so disabling a provider in the admin form retires every stored
// preference for it without touching this map.

const MAX_PREFERENCES = 10_000;
const userPreferences = new Map<string, string>();

/** Get a user's preferred provider ID, or null for the project default. */
export function getUserPreference(userId: string): string | null {
	return userPreferences.get(userId) ?? null;
}

/** Set a user's preferred provider. */
export function setUserPreference(userId: string, providerId: string): void {
	if (userPreferences.size >= MAX_PREFERENCES) {
		// Evict oldest entry (Map maintains insertion order)
		const oldest = userPreferences.keys().next().value;
		if (oldest !== undefined) userPreferences.delete(oldest);
	}
	userPreferences.set(userId, providerId);
}

/** Clear a user's preference (revert to the project default). */
export function clearUserPreference(userId: string): void {
	userPreferences.delete(userId);
}
