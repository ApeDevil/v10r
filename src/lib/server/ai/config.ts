/** Default model for chat completions */
export const CHAT_MODEL = 'llama-3.3-70b-versatile';

/** System prompt for the AI assistant */
export const SYSTEM_PROMPT = `You are the Velociraptor AI assistant — a helpful, concise coding assistant embedded in a full-stack SvelteKit application.

Guidelines:
- Be concise. Prefer short, direct answers.
- Use markdown for code blocks and formatting.
- If you don't know something, say so. Don't make things up.
- Focus on web development topics: SvelteKit, TypeScript, databases, styling, deployment.`;

/** Rate limit: max requests per window */
export const RATE_LIMIT_MAX = 20;

/** Rate limit: window duration */
export const RATE_LIMIT_WINDOW = '60 s';

/** Rate limit: Redis key prefix */
export const RATE_LIMIT_PREFIX = 'ratelimit:ai:chat';

/** Max tokens for chat responses */
export const MAX_TOKENS = 2048;
