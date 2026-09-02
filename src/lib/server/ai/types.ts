import type { UIMessage } from 'ai';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string } | UIMessage;

export interface AiProviderStatus {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	envVar: string;
}
