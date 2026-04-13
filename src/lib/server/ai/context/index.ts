/** Context slice — the harness lens's "context" primitive. See `docs/blueprint/ai/harness-lens.md`. */

export type { ChatMessage, SystemPromptInput } from './system-prompt';
export {
	buildSystemPrompt,
	escapeXmlAttr,
	getMessageText,
	windowMessages,
} from './system-prompt';
