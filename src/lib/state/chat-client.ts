/**
 * The AI SDK's chat client — `Chat` and its default transport — behind one module.
 *
 * Both chat sessions (`chatbot-session.svelte.ts`, lazily; the desk `desk-bot-session.svelte.ts`,
 * statically) take them from here and never `import('ai')` themselves: a dynamic import of a
 * package entry has to preserve every export of that package, so the WHOLE `ai` client index —
 * 283 KB raw, 75 KB gzipped — shipped for one class. A dynamic import of this module keeps the
 * graph off the baseline bundle (the chatbot mounts on every page) while Rollup still shakes `ai`
 * down to what these two exports use.
 */
export { Chat } from '@ai-sdk/svelte';
export { DefaultChatTransport } from 'ai';
