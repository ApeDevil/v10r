import { eq } from 'drizzle-orm';
import { ADMIN_FLAG_CACHE_TTL_MS } from '$lib/server/config';
import { db } from '$lib/server/db';
import { systemConfig } from '$lib/server/db/schema/admin';

// ── In-Process Cache ──────────────────────────────────────────────────────────

const cache = new Map<string, { value: unknown; cachedAt: number }>();

export function invalidateFlagCache(): void {
	cache.clear();
}

export function getFlagCacheSize(): number {
	return cache.size;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getFlag(key: string): Promise<unknown | null> {
	const cached = cache.get(key);
	if (cached && Date.now() - cached.cachedAt < ADMIN_FLAG_CACHE_TTL_MS) {
		return cached.value;
	}

	const result = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);

	if (result.length === 0) {
		cache.set(key, { value: null, cachedAt: Date.now() });
		return null;
	}

	const value = result[0].value;
	cache.set(key, { value, cachedAt: Date.now() });
	return value;
}

export async function getAllFlags() {
	return db.select().from(systemConfig).orderBy(systemConfig.key);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function setFlag(
	key: string,
	value: unknown,
	options?: { description?: string; updatedBy?: string },
): Promise<void> {
	await db
		.insert(systemConfig)
		.values({
			key,
			value,
			description: options?.description,
			updatedBy: options?.updatedBy,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: systemConfig.key,
			set: {
				value,
				...(options?.description !== undefined && { description: options.description }),
				updatedBy: options?.updatedBy,
				updatedAt: new Date(),
			},
		});

	cache.delete(key);
}

export async function deleteFlag(key: string): Promise<void> {
	await db.delete(systemConfig).where(eq(systemConfig.key, key));
	cache.delete(key);
}
