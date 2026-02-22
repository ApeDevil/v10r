import { env } from '$env/dynamic/private';
import { createGroq } from '@ai-sdk/groq';
import { CHAT_MODEL } from './config';

const apiKey = env.GROQ_API_KEY ?? '';

/** Whether AI is configured (API key present) */
export const aiConfigured = apiKey.length > 0;

/** Groq provider instance — null when no API key is set */
export const groq = aiConfigured ? createGroq({ apiKey }) : null;

/** Default chat model — null when provider is unavailable */
export const chatModel = groq ? groq(CHAT_MODEL) : null;
