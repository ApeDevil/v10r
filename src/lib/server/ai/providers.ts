import { env } from '$env/dynamic/private';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export interface ProviderEntry {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	envVar: string;
	getInstance: () => LanguageModel | null;
}

const PROVIDER_CONFIGS: {
	id: string;
	name: string;
	model: string;
	envVar: string;
	factory: (apiKey: string) => LanguageModel;
}[] = [
	{
		id: 'groq',
		name: 'Groq',
		model: 'llama-3.3-70b-versatile',
		envVar: 'GROQ_API_KEY',
		factory: (apiKey) => createGroq({ apiKey })('llama-3.3-70b-versatile'),
	},
	{
		id: 'openai',
		name: 'OpenAI',
		model: 'gpt-4o-mini',
		envVar: 'OPENAI_API_KEY',
		factory: (apiKey) => createOpenAI({ apiKey })('gpt-4o-mini'),
	},
	{
		id: 'google',
		name: 'Google Gemini',
		model: 'gemini-2.0-flash',
		envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
		factory: (apiKey) => createGoogleGenerativeAI({ apiKey })('gemini-2.0-flash'),
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
			getInstance: () => (configured ? config.factory(apiKey) : null),
		};
	});
}

/** Resolve which provider to use: AI_PROVIDER env var → first configured */
export function resolveActiveProvider(
	registry: ProviderEntry[],
): ProviderEntry | null {
	const preferred = env.AI_PROVIDER ?? '';
	if (preferred) {
		const match = registry.find((p) => p.id === preferred && p.configured);
		if (match) return match;
	}
	return registry.find((p) => p.configured) ?? null;
}

/** Get other configured providers as fallbacks */
export function getFallbackProviders(
	registry: ProviderEntry[],
	activeId: string,
): ProviderEntry[] {
	return registry.filter((p) => p.configured && p.id !== activeId);
}
