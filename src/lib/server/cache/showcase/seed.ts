import { redis } from '../index';

const SHOWCASE_PREFIX = 'showcase:';

/** Delete all showcase keys and re-populate with seed data. */
export async function reseedCache(): Promise<{ keyCount: number }> {
	// 1. Clear all existing showcase keys
	const existing = await redis.keys(`${SHOWCASE_PREFIX}*`);
	if (existing.length > 0) {
		await redis.del(...existing);
	}

	// 2. Seed strings
	await Promise.all([
		redis.set('showcase:config:site-name', 'Velociraptor'),
		redis.set('showcase:config:version', '0.0.1'),
		redis.set(
			'showcase:json:stack-summary',
			JSON.stringify({
				runtime: 'Bun',
				framework: 'SvelteKit 2',
				language: 'TypeScript',
				styling: 'UnoCSS',
				database: 'PostgreSQL + Neo4j + Redis',
				storage: 'Cloudflare R2',
			}),
		),
	]);

	// 3. Seed TTL entries
	await Promise.all([
		redis.set('showcase:ttl:verification-code', 'V10R-8X2K', { ex: 300 }),
		redis.set('showcase:ttl:flash-message', 'Database reseeded successfully.', { ex: 30 }),
		redis.set('showcase:ttl:session-token', 'ses_demo_abc123def456', { ex: 3600 }),
	]);

	// 4. Seed counters
	await Promise.all([
		redis.set('showcase:counter:page-views', 1500000),
		redis.set('showcase:counter:api-calls-today', 4200),
	]);

	// 5. Seed hashes
	await Promise.all([
		redis.hset('showcase:hash:feature-flags', {
			dark_mode: '1',
			beta_ui: '0',
			cache_showcase: '1',
			graph_viz: '1',
			ai_chat: '0',
		}),
		redis.hset('showcase:hash:user-prefs', {
			theme: 'system',
			language: 'en',
			page_size: '25',
			notifications: 'true',
		}),
	]);

	// 6. Seed sorted set (leaderboard)
	await redis.zadd('showcase:leaderboard:tech-popularity', ...[
		{ score: 95, member: 'Svelte' },
		{ score: 92, member: 'PostgreSQL' },
		{ score: 88, member: 'Bun' },
		{ score: 85, member: 'UnoCSS' },
		{ score: 82, member: 'Drizzle' },
		{ score: 78, member: 'Neo4j' },
		{ score: 75, member: 'Valibot' },
		{ score: 70, member: 'Threlte' },
	]);

	// 7. Seed list (queue)
	await redis.rpush(
		'showcase:queue:recent-events',
		'user:login {"user":"alice","ts":"2025-01-15T10:30:00Z"}',
		'page:view {"path":"/showcases/db","ts":"2025-01-15T10:31:00Z"}',
		'cache:hit {"key":"config:site-name","ts":"2025-01-15T10:31:05Z"}',
		'api:call {"endpoint":"/api/health","ts":"2025-01-15T10:32:00Z"}',
		'user:logout {"user":"alice","ts":"2025-01-15T10:45:00Z"}',
	);

	// 8. Count final keys
	const keys = await redis.keys(`${SHOWCASE_PREFIX}*`);
	return { keyCount: keys.length };
}
