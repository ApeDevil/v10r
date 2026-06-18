import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { customPalettes } from '$lib/server/db/schema/app/custom-palettes';
import type { PaletteColors } from '$lib/styles/random/types';

type CustomPaletteRow = typeof customPalettes.$inferSelect;

/**
 * In-memory TTL cache for getCustomPaletteById. The style cookie is read on EVERY
 * request in the loadStyle hook — before any auth or rate limit — and a `CP_` value
 * triggers this lookup. Without caching, an attacker can turn each request into a
 * Neon round-trip via a forged cookie. Negative results are cached too (bounded) so
 * spamming bogus ids can't amplify DB load. Palettes are effectively immutable per
 * id; update/delete invalidate the entry.
 */
const PALETTE_CACHE_TTL_MS = 60_000;
const PALETTE_CACHE_MAX = 1_000;
const paletteByIdCache = new Map<string, { value: CustomPaletteRow | null; expiresAt: number }>();

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
	const cached = paletteByIdCache.get(id);
	if (cached && cached.expiresAt > Date.now()) return cached.value;

	const [palette] = await db.select().from(customPalettes).where(eq(customPalettes.id, id)).limit(1);
	const value = palette ?? null;

	if (paletteByIdCache.size >= PALETTE_CACHE_MAX) paletteByIdCache.clear();
	paletteByIdCache.set(id, { value, expiresAt: Date.now() + PALETTE_CACHE_TTL_MS });
	return value;
}

export async function getCustomPalette(id: string, userId: string) {
	const [palette] = await db
		.select()
		.from(customPalettes)
		.where(and(eq(customPalettes.id, id), eq(customPalettes.createdBy, userId)))
		.limit(1);
	return palette ?? null;
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
