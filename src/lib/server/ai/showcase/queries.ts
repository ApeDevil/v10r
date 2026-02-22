import { generateText } from 'ai';
import { aiConfigured, chatModel } from '../index';
import { CHAT_MODEL } from '../config';
import { classifyAIError } from '../errors';
import type { AIConnectionInfo, AIProviderStatus } from '../types';

/** Verify AI provider connection with a lightweight test call */
export async function verifyAIConnection(): Promise<AIConnectionInfo> {
	if (!aiConfigured || !chatModel) {
		return {
			connected: false,
			provider: 'groq',
			model: CHAT_MODEL,
			latencyMs: null,
			error: 'GROQ_API_KEY is not configured',
		};
	}

	const start = performance.now();

	try {
		await generateText({
			model: chatModel,
			prompt: 'Reply with "ok".',
			maxTokens: 5,
		});

		return {
			connected: true,
			provider: 'groq',
			model: CHAT_MODEL,
			latencyMs: Math.round(performance.now() - start),
			error: null,
		};
	} catch (err) {
		const aiErr = classifyAIError(err);
		return {
			connected: false,
			provider: 'groq',
			model: CHAT_MODEL,
			latencyMs: Math.round(performance.now() - start),
			error: aiErr.message,
		};
	}
}

/** Get status of all configured AI providers */
export function getProviderStatuses(): AIProviderStatus[] {
	return [
		{
			id: 'groq',
			name: 'Groq',
			configured: aiConfigured,
			model: CHAT_MODEL,
		},
	];
}
