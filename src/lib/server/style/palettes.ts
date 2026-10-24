import { and, count, eq } from 'drizzle-orm';
import { createId } from '#lib/server/db/id.ts';
import { db } from '#lib/server/db/index.ts';
import { customPalettes } from '#lib/server/db/schema/personalization/custom-palettes.ts';
import type { PaletteColors } from '#lib/styles/random/types.ts';

export type CustomPaletteRow = typeof customPalettes.$inferSelect;

/**
 * In-memory TTL cache for getCustomPaletteById. The style cookie is read on EVERY
 * request in the loadStyle hook — before any auth or rate limit — and a `CP_` value
 * triggers this lookup. Without caching, an attacker can turn each request into a
 * Neon round-trip via a forged cookie. Negative results are cached too (bounded) so
 * spamming bogus ids can't amplify DB load. Palettes are effectively immutable per
 * id; update/delete invalidate the entry.
 *
 * An id that `createId.palette()` could not have produced is refused before the cache
 * and the database, so arbitrary cookie junk costs nothing. A WELL-FORMED unknown id
 * still costs one query per distinct id per TTL — format validation narrows the input,
 * it cannot make guessing free.
 *
 * Least-recently-used eviction at the cap. The previous `clear()` let a burst of bogus
 * ids flush every real visitor's palette along with them.
 */
const PALETTE_CACHE_TTL_MS = 60_000;
const PALETTE_CACHE_MAX = 1_000;
const paletteByIdCache = new Map<string, { value: CustomPaletteRow | null; expiresAt: number }>();

/** The exact shape `createId.palette()` mints: `CP_` + 12 lowercase hex. */
const CUSTOM_PALETTE_ID = /^CP_[0-9a-f]{12}$/;

function isCustomPaletteId(id: string): boolean {
	return CUSTOM_PALETTE_ID.test(id);
}

export async function createCustomPalette(data: {
	name: string;
	description?: string;
	basePaletteId: string;
	lightColors: PaletteColors;
	darkColors: PaletteColors;
	accentOffset?: number;
	createdBy: string;
}) {
	const id = createId.palette();
	const [palette] = await db
		.insert(customPalettes)
		.values({
			id,
			name: data.name,
			description: data.description ?? '',
			basePaletteId: data.basePaletteId,
			lightColors: data.lightColors as unknown as Record<string, string>,
			darkColors: data.darkColors as unknown as Record<string, string>,
			accentOffset: data.accentOffset ?? 0,
			createdBy: data.createdBy,
		})
		.returning();
	return palette;
}

/** Get a custom palette by ID only (no user check — for SSR rendering). Cached (see above). */
export async function getCustomPaletteById(id: string): Promise<CustomPaletteRow | null> {
	if (!isCustomPaletteId(id)) return null;

	const cached = paletteByIdCache.get(id);
	if (cached && cached.expiresAt > Date.now()) {
		// Re-insert to mark it most recently used — a Map iterates in insertion order.
		paletteByIdCache.delete(id);
		paletteByIdCache.set(id, cached);
		return cached.value;
	}

	const [palette] = await db.select().from(customPalettes).where(eq(customPalettes.id, id)).limit(1);
	const value = palette ?? null;

	paletteByIdCache.delete(id);
	if (paletteByIdCache.size >= PALETTE_CACHE_MAX) {
		const leastRecent = paletteByIdCache.keys().next().value;
		if (leastRecent !== undefined) paletteByIdCache.delete(leastRecent);
	}
	paletteByIdCache.set(id, { value, expiresAt: Date.now() + PALETTE_CACHE_TTL_MS });
	return value;
}

/** Row count for a user — backs the per-user creation cap. */
export async function countCustomPalettes(userId: string): Promise<number> {
	const [row] = await db.select({ value: count() }).from(customPalettes).where(eq(customPalettes.createdBy, userId));
	return row?.value ?? 0;
}

export async function listCustomPalettes(userId: string) {
	return db.select().from(customPalettes).where(eq(customPalettes.createdBy, userId)).orderBy(customPalettes.createdAt);
}

export async function updateCustomPalette(
	id: string,
	userId: string,
	data: {
		name?: string;
		description?: string;
		lightColors?: PaletteColors;
		darkColors?: PaletteColors;
		accentOffset?: number;
	},
) {
	const { lightColors, darkColors, ...rest } = data;
	const [updated] = await db
		.update(customPalettes)
		.set({
			...rest,
			...(lightColors && { lightColors: lightColors as unknown as Record<string, string> }),
			...(darkColors && { darkColors: darkColors as unknown as Record<string, string> }),
			updatedAt: new Date(),
		})
		.where(and(eq(customPalettes.id, id), eq(customPalettes.createdBy, userId)))
		.returning();
	paletteByIdCache.delete(id);
	return updated ?? null;
}

export async function deleteCustomPalette(id: string, userId: string) {
	const [deleted] = await db
		.delete(customPalettes)
		.where(and(eq(customPalettes.id, id), eq(customPalettes.createdBy, userId)))
		.returning();
	paletteByIdCache.delete(id);
	return deleted ?? null;
}
