import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { env } from '$env/dynamic/private';

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

/** Resolve which provider to use: AI_PROVIDER env var → first configured */
export function resolveActiveProvider(registry: ProviderEntry[]): ProviderEntry | null {
	const preferred = env.AI_PROVIDER ?? '';
	if (preferred) {
		const match = registry.find((p) => p.id === preferred && p.configured);
		if (match) return match;
	}
	return registry.find((p) => p.configured) ?? null;
}

/** Get other configured providers as fallbacks */
export function getFallbackProviders(registry: ProviderEntry[], activeId: string): ProviderEntry[] {
	return registry.filter((p) => p.configured && p.id !== activeId);
}

// ── Circuit breaker — cooldown for rate-limited providers ──────────

const cooldowns = new Map<string, number>();

/** Mark a provider as rate-limited for `durationMs` (default 60s). */
export function markCooldown(providerId: string, durationMs = 60_000): void {
	cooldowns.set(providerId, Date.now() + durationMs);
}

/** Check if a provider is currently in cooldown. Auto-clears expired entries. */
export function isCooledDown(providerId: string): boolean {
	const resumeAt = cooldowns.get(providerId);
	if (!resumeAt) return false;
	if (Date.now() >= resumeAt) {
		cooldowns.delete(providerId);
		return false;
	}
	return true;
}

/**
 * Resolve a provider that supports tool calling.
 * Prefers OpenAI > Google > others. Returns null if no tool-capable provider is configured.
 */
export function resolveToolProvider(registry: ProviderEntry[]): ProviderEntry | null {
	const toolProviders = registry.filter((p) => p.configured && p.supportsTools);
	// Respect AI_PROVIDER if it supports tools
	const envProvider = env.AI_PROVIDER ?? '';
	if (envProvider) {
		const envMatch = toolProviders.find((p) => p.id === envProvider);
		if (envMatch) return envMatch;
	}
	// Fallback to hardcoded preference
	const preferred = ['openai', 'google'];
	for (const id of preferred) {
		const match = toolProviders.find((p) => p.id === id);
		if (match) return match;
	}
	return toolProviders[0] ?? null;
}
