/**
 * What a generation model can do, derived from its id — not from its vendor.
 *
 * Capabilities used to be booleans on the provider entry, which was fine while the model
 * was hardcoded beside them. Once an administrator can type any model id, "OpenAI"
 * saying nothing about whether *this* model accepts images: a text-only id on a
 * vision-capable vendor must not keep receiving image parts. So the flags hang off the
 * model id, matched against the families the code has actually been exercised with.
 *
 * An unrecognized id is treated as text-only — it can still answer chat turns, but the
 * tool and vision resolvers skip it until someone adds its family here. The admin page
 * shows that state explicitly; a generic generation probe cannot prove either capability.
 *
 * Alias-free on purpose (reached from `connections.ts`, which the bare-Bun scripts import).
 */
import type { AiProviderId } from '../../types/db-enums';

export interface ModelCapabilities {
	/** Reliably emits structured `tool_calls` (see `tool-leak-guard.ts` for Groq/llama drift). */
	tools: boolean;
	/** Accepts image parts as input. */
	vision: boolean;
	/** Whether the id matched a known family; false means the flags above are the conservative floor. */
	recognized: boolean;
}

interface ModelFamily {
	provider: AiProviderId;
	matches: RegExp;
	tools: boolean;
	vision: boolean;
}

const MODEL_FAMILIES: ModelFamily[] = [
	// Groq — llama-3.x can drift into textual tool calls; stepCountIs bounds it. Text-only.
	{ provider: 'groq', matches: /^llama-3\./, tools: true, vision: false },
	{ provider: 'groq', matches: /^openai\/gpt-oss-/, tools: true, vision: false },
	// OpenAI — the gpt-4o / gpt-4.1 / gpt-5 families are multimodal with reliable tool calls.
	{ provider: 'openai', matches: /^gpt-4o/, tools: true, vision: true },
	{ provider: 'openai', matches: /^gpt-4\.1/, tools: true, vision: true },
	{ provider: 'openai', matches: /^gpt-5/, tools: true, vision: true },
	// Google — Gemini 1.5+ is natively multimodal; tool calling works (optional-array quirks).
	{ provider: 'google', matches: /^gemini-(?:1\.5|2\.0|2\.5|3)/, tools: true, vision: true },
];

const UNRECOGNIZED: ModelCapabilities = { tools: false, vision: false, recognized: false };

export function capabilitiesFor(provider: AiProviderId, modelId: string): ModelCapabilities {
	const family = MODEL_FAMILIES.find((f) => f.provider === provider && f.matches.test(modelId));
	return family ? { tools: family.tools, vision: family.vision, recognized: true } : UNRECOGNIZED;
}
