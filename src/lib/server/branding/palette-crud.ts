import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { createId } from '$lib/server/db/id';
import { customPalettes } from '$lib/server/db/schema/app/custom-palettes';
import type { PaletteColors } from '$lib/styles/random/types';

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

/** Get a custom palette by ID only (no user check — for SSR rendering) */
export async function getCustomPaletteById(id: string) {
	const [palette] = await db.select().from(customPalettes).where(eq(customPalettes.id, id)).limit(1);
	return palette ?? null;
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
	return updated ?? null;
}

export async function deleteCustomPalette(id: string, userId: string) {
	const [deleted] = await db
		.delete(customPalettes)
		.where(and(eq(customPalettes.id, id), eq(customPalettes.createdBy, userId)))
		.returning();
	return deleted ?? null;
}
