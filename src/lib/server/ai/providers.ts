import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { env } from '$env/dynamic/private';
import { redis } from '$lib/server/cache';

export interface ProviderEntry {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	envVar: string;
	/** Whether this provider reliably supports tool calling. */
	supportsTools: boolean;
	getInstance: () => LanguageModel | null;
}

const PROVIDER_CONFIGS: {
	id: string;
	name: string;
	model: string;
	envVar: string;
	supportsTools: boolean;
	factory: (apiKey: string) => LanguageModel;
}[] = [
	{
		id: 'groq',
		name: 'Groq',
		model: 'llama-3.3-70b-versatile',
		envVar: 'GROQ_API_KEY',
		supportsTools: true, // Llama can drift in long multi-turn, but our stepCountIs(3) bounds it
		factory: (apiKey) => createGroq({ apiKey })('llama-3.3-70b-versatile'),
	},
	{
		id: 'openai',
		name: 'OpenAI',
		model: 'gpt-4o-mini',
		envVar: 'OPENAI_API_KEY',
		supportsTools: true, // Most reliable for tool calling
		factory: (apiKey) => createOpenAI({ apiKey })('gpt-4o-mini'),
	},
	{
		id: 'google',
		name: 'Google Gemini',
		model: 'gemini-2.5-flash',
		envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
		supportsTools: true, // Works but known issues with optional arrays
		factory: (apiKey) => createGoogleGenerativeAI({ apiKey })('gemini-2.5-flash'),
	},
];

/** Build provider registry from environment variables */
export function buildProviderRegistry(): ProviderEntry[] {
	return PROVIDER_CONFIGS.map((config) => {
		const apiKey = env[config.envVar] ?? '';
		const configured = apiKey.length > 0;

		return {
			id: config.id,
			name: config.name,
			configured,
			model: config.model,
			envVar: config.envVar,
			supportsTools: config.supportsTools,
			getInstance: () => (configured ? config.factory(apiKey) : null),
		};
	});
}

/** Resolve which provider to use: user preference → AI_PROVIDER env var → first configured */
export function resolveActiveProvider(registry: ProviderEntry[], preference?: string | null): ProviderEntry | null {
	if (preference) {
		const match = registry.find((p) => p.id === preference && p.configured);
		if (match) return match;
	}
	const envPref = env.AI_PROVIDER ?? '';
	if (envPref) {
		const match = registry.find((p) => p.id === envPref && p.configured);
		if (match) return match;
	}
	return registry.find((p) => p.configured) ?? null;
}

/** Get other configured providers as fallbacks */
export function getFallbackProviders(registry: ProviderEntry[], activeId: string): ProviderEntry[] {
	return registry.filter((p) => p.configured && p.id !== activeId);
}

// ── Circuit breaker — cooldown for rate-limited providers ──────────
//
// Stored in Redis so the breaker is shared across serverless instances — an
// in-process Map would let every cold lambda independently re-trip a provider
// that another instance already cooled. Falls back to an in-memory Map when
// Redis is unavailable (dev / tests). All three accessors are async as a result.

const COOLDOWN_PREFIX = 'ai:cooldown:';
const cooldowns = new Map<string, number>(); // fallback store when redis is null

/** Reset the in-memory fallback store. For test cleanup only (no-op against Redis). */
export function resetCooldowns(): void {
	cooldowns.clear();
}

/** Mark a provider as rate-limited for `durationMs` (default 60s). Non-blocking. */
export async function markCooldown(providerId: string, durationMs = 60_000): Promise<void> {
	const resumeAt = Date.now() + durationMs;
	if (redis) {
		try {
			await redis.set(`${COOLDOWN_PREFIX}${providerId}`, resumeAt, { px: durationMs });
		} catch (err) {
			console.error('[ai:providers] Failed to set cooldown:', err);
		}
		return;
	}
	cooldowns.set(providerId, resumeAt);
}

/** Resolve a provider's cooldown resume time (epoch ms), or null if not cooled. */
async function cooldownResumeMs(providerId: string): Promise<number | null> {
	if (redis) {
		try {
			const resumeAt = await redis.get<number>(`${COOLDOWN_PREFIX}${providerId}`);
			if (!resumeAt || Date.now() >= resumeAt) return null;
			return resumeAt;
		} catch (err) {
			console.error('[ai:providers] Failed to read cooldown:', err);
			return null;
		}
	}
	const resumeAt = cooldowns.get(providerId);
	if (!resumeAt) return null;
	if (Date.now() >= resumeAt) {
		cooldowns.delete(providerId);
		return null;
	}
	return resumeAt;
}

/** Check if a provider is currently in cooldown. */
export async function isCooledDown(providerId: string): Promise<boolean> {
	return (await cooldownResumeMs(providerId)) !== null;
}

/**
 * Resolve a provider that supports tool calling.
 * User preference → AI_PROVIDER → OpenAI > Google > others.
 */
export function resolveToolProvider(registry: ProviderEntry[], preference?: string | null): ProviderEntry | null {
	const toolProviders = registry.filter((p) => p.configured && p.supportsTools);
	if (preference) {
		const match = toolProviders.find((p) => p.id === preference);
		if (match) return match;
	}
	const envProvider = env.AI_PROVIDER ?? '';
	if (envProvider) {
		const envMatch = toolProviders.find((p) => p.id === envProvider);
		if (envMatch) return envMatch;
	}
	const preferred = ['openai', 'google'];
	for (const id of preferred) {
		const match = toolProviders.find((p) => p.id === id);
		if (match) return match;
	}
	return toolProviders[0] ?? null;
}

// ── User provider preferences (in-memory, resets on server restart) ──

const MAX_PREFERENCES = 10_000;
const userPreferences = new Map<string, string>();

/** Get a user's preferred provider ID, or null for server default. */
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

/** Clear a user's preference (revert to server default). */
export function clearUserPreference(userId: string): void {
	userPreferences.delete(userId);
}

/** Get the cooldown resume time as ISO string, or null if not cooled down. */
export async function getCooldownResumeAt(providerId: string): Promise<string | null> {
	const ms = await cooldownResumeMs(providerId);
	return ms === null ? null : new Date(ms).toISOString();
}
