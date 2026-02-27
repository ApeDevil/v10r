import { env } from '$env/dynamic/private';

export const features = {
	redis: !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
	r2: !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME),
	neo4j: !!env.NEO4J_URI,
	ai: !!(env.GROQ_API_KEY || env.OPENAI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
} as const;

export type FeatureId = keyof typeof features;

export function logFeatureStatus(): void {
	const entries = Object.entries(features) as [FeatureId, boolean][];
	const enabled = entries.filter(([, v]) => v).map(([k]) => k);
	const disabled = entries.filter(([, v]) => !v).map(([k]) => k);
	console.log(`[features] enabled: ${enabled.join(', ') || 'none'}`);
	if (disabled.length) console.log(`[features] disabled: ${disabled.join(', ')}`);
}
