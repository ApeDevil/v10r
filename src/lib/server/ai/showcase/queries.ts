import { generateText } from 'ai';
import { classifyAIError } from '../errors';
import { activeProviderInfo, aiConfigured, chatModel, providerRegistry } from '../index';
import type { AIConnectionInfo, AIProviderStatus } from '../types';

/** Verify AI provider connection with a lightweight test call */
export async function verifyAIConnection(): Promise<AIConnectionInfo> {
	if (!aiConfigured || !chatModel || !activeProviderInfo) {
		return {
			connected: false,
			provider: 'none',
			model: 'none',
			latencyMs: null,
			error: 'No AI provider is configured',
		};
	}

	const start = performance.now();

	try {
		await generateText({
			model: chatModel,
			prompt: 'Reply with "ok".',
			maxOutputTokens: 5,
		});

		return {
			connected: true,
			provider: activeProviderInfo.id,
			model: activeProviderInfo.model,
			latencyMs: Math.round(performance.now() - start),
			error: null,
		};
	} catch (err) {
		const aiErr = classifyAIError(err);
		return {
			connected: false,
			provider: activeProviderInfo.id,
			model: activeProviderInfo.model,
			latencyMs: Math.round(performance.now() - start),
			error: aiErr.message,
		};
	}
}

/** Get status of all configured AI providers */
export function getProviderStatuses(): AIProviderStatus[] {
	return providerRegistry.map((p) => ({
		id: p.id,
		name: p.name,
		configured: p.configured,
		model: p.model,
		envVar: p.envVar,
	}));
}
