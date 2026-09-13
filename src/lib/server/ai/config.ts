import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

/**
 * Agent-loop step budgets (AI SDK v6 `stopWhen: stepCountIs(n)`). Externalized here so
 * the quota-discipline ceilings live in one place instead of as literals scattered across
 * the orchestrator + tool factory. Numbers match the prior inline behavior exactly.
 *
 * - `CHATBOT_MAX_STEPS` — read-only grounded Q&A: retrieve → answer, plus search tool hops.
 * - `DESK_READ_MAX_STEPS` — deskbot with only read/ask scopes (no mutation).
 * - `DESK_MUTATE_MAX_STEPS` — deskbot with a mutating scope (write/create/delete): one extra hop
 *   for the plan-propose → execute step.
 */
export const CHATBOT_MAX_STEPS = 3;

export const DESK_READ_MAX_STEPS = 3;

export const DESK_MUTATE_MAX_STEPS = 5;

/**
 * Characters a desk read tool returns per call — and the most of a document the model can
 * have seen in one read. `desk_update_markdown` refuses to replace a document longer than
 * this whole: a rewrite of what was only partly read would truncate the file.
 */
export const DESK_READ_MAX_CHARS = 8_000;

/**
 * Characters of the corpus map the `project-map` capability injects as `<project-overview>`
 * on every chatbot turn (~500 tokens). `docs/overview-body.ts` builds the map so its intro
 * and stack line land ahead of this cut; the table of contents below them may be lost.
 */
export const PROJECT_MAP_MAX_CHARS = 2_000;

/**
 * Provider options for chatbot generation (`streamText({ providerOptions })`; each provider
 * reads only its own key, so the record is passed whole). Gemini 2.5 Flash thinks by default,
 * and that thinking is most of what a step waits for before its first token — but trading it
 * for latency is a quality decision the paired A/B settles, not this constant. The candidate
 * arm is `google: { thinkingConfig: { thinkingBudget: 0 } }`; `reasoningTokens` on the
 * `generate` terminal (0 when the budget is honoured) tells the arms apart in every trace.
 * Empty — today's behavior — until the A/B is accepted.
 */
export const CHATBOT_GENERATION_OPTIONS = {} satisfies { google?: GoogleGenerativeAIProviderOptions };

/** Chat endpoint rate limit: requests per window */
export const RATE_LIMIT_MAX = 20;

/** Chat endpoint rate limit: window duration */
export const RATE_LIMIT_WINDOW = '60 s';

/** Chat endpoint rate limit: Redis key prefix */
export const RATE_LIMIT_PREFIX = 'ratelimit:ai:chat';

/** Max tokens for chat responses */
export const MAX_TOKENS = 2048;

/**
 * Daily AI token budget per user (input + output).
 * Caps cost-amplification abuse to ~$1-2/user/day on premium models.
 * Resets at UTC day boundary.
 */
export const DAILY_TOKEN_CAP = 100_000;

export const MAX_CONVERSATIONS_PER_USER = 200;

/** Conversation CRUD rate limit: requests per window */
export const CONVERSATION_RATE_LIMIT_MAX = 30;

/** Conversation CRUD rate limit: window duration */
export const CONVERSATION_RATE_LIMIT_WINDOW = '60 s';

/** Conversation CRUD rate limit: Redis key prefix */
export const CONVERSATION_RATE_LIMIT_PREFIX = 'ratelimit:ai:conversations';

/**
 * Connection test — the admin's "does this provider/model answer?" probe. A fixed synthetic
 * prompt, a tiny output cap and one attempt, so a test costs a few tokens and never
 * carries user content or tools. Rate-limited per admin because each test is a real,
 * quota-consuming provider call.
 */
export const CONNECTION_TEST_PROMPT = 'Reply with the single word OK.';

export const CONNECTION_TEST_MAX_OUTPUT_TOKENS = 16;

export const CONNECTION_TEST_TIMEOUT_MS = 8_000;

export const CONNECTION_TEST_RATE_LIMIT_MAX = 10;

export const CONNECTION_TEST_RATE_LIMIT_WINDOW = '60 s';

export const CONNECTION_TEST_RATE_LIMIT_PREFIX = 'ratelimit:admin:ai:test';
