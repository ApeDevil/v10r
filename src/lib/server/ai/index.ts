import type { ProviderEntry } from './providers';
import {
	buildProviderRegistry,
	getFallbackProviders,
	getUserPreference,
	resolveActiveProvider,
	resolveToolProvider,
	resolveVisionProvider,
} from './providers';

const registry = buildProviderRegistry();

/** Whether any AI provider is configured (static — doesn't change at runtime). */
export const aiConfigured = registry.some((p) => p.configured);

/** Full provider registry for status pages and API endpoints. */
export const providerRegistry = registry;

// Per-request resolution functions

/**
 * Get the active provider for a given user.
 * Resolution: explicit override → stored preference → env → first configured.
 */
export function getActiveProvider(userId?: string, overrideProviderId?: string): ProviderEntry | null {
	const pref = overrideProviderId ?? (userId ? getUserPreference(userId) : null);
	return resolveActiveProvider(registry, pref);
}

/**
 * Get the tool-capable provider for a given user.
 * Resolution: explicit override → stored preference → env → hardcoded order.
 */
export function getToolProvider(userId?: string, overrideProviderId?: string): ProviderEntry | null {
	const pref = overrideProviderId ?? (userId ? getUserPreference(userId) : null);
	return resolveToolProvider(registry, pref);
}

/**
 * Get the vision-capable provider for a given user (for image analysis).
 * Resolution: explicit override → stored preference → env → Google > OpenAI.
 * Groq is never returned. Null when no vision provider is configured.
 */
export function getVisionProvider(userId?: string, overrideProviderId?: string): ProviderEntry | null {
	const pref = overrideProviderId ?? (userId ? getUserPreference(userId) : null);
	return resolveVisionProvider(registry, pref);
}

/** Get provider info { id, name, model } for a given user, or null. */
export function getActiveProviderInfo(
	userId?: string,
	overrideProviderId?: string,
): { id: string; name: string; model: string } | null {
	const active = getActiveProvider(userId, overrideProviderId);
	return active ? { id: active.id, name: active.name, model: active.model } : null;
}

/** Get fallback providers for a given user's active provider. */
export function getFallbacksForUser(userId?: string, overrideProviderId?: string): ProviderEntry[] {
	const active = getActiveProvider(userId, overrideProviderId);
	return active ? getFallbackProviders(registry, active.id) : [];
}
