import { and, eq } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { deskTheme, deskThemePreset } from '../schema/desk';
import type { TypeStylesJson, WorkspaceColorsJson } from '../schema/desk/theme';

/** Upsert the user's active desk theme. */
export async function saveDeskTheme(
	userId: string,
	data: {
		workspace: WorkspaceColorsJson;
		typeStyles: TypeStylesJson;
		activePresetId: string | null;
	},
) {
	const [row] = await db
		.insert(deskTheme)
		.values({ userId, ...data, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: deskTheme.userId,
			set: { ...data, updatedAt: new Date() },
		})
		.returning();
	return row;
}

/** Create a user preset. */
export async function createDeskPreset(
	userId: string,
	data: {
		name: string;
		workspace: WorkspaceColorsJson;
		typeStyles: TypeStylesJson;
	},
) {
	const [row] = await db
		.insert(deskThemePreset)
		.values({ id: createId.themePreset(), userId, ...data })
		.returning();
	return row;
}

/** Delete a user preset (ownership enforced). */
export async function deleteDeskPreset(id: string, userId: string) {
	const [row] = await db
		.delete(deskThemePreset)
		.where(and(eq(deskThemePreset.id, id), eq(deskThemePreset.userId, userId)))
		.returning();
	return row ?? null;
}

/**
 * Migrate from localStorage — idempotent.
 * If DB row exists, does nothing and returns false.
 * Otherwise inserts theme + any user presets, returns true.
 */
export async function migrateDeskTheme(
	userId: string,
	data: {
		workspace: WorkspaceColorsJson;
		typeStyles: TypeStylesJson;
		activePresetId: string | null;
		userPresets: Array<{
			name: string;
			workspace: WorkspaceColorsJson;
			typeStyles: TypeStylesJson;
		}>;
	},
) {
	return db.transaction(async (tx) => {
		// Check if row already exists
		const [existing] = await tx
			.select({ userId: deskTheme.userId })
			.from(deskTheme)
			.where(eq(deskTheme.userId, userId))
			.limit(1);

		if (existing) return false;

		// Insert theme row
		await tx.insert(deskTheme).values({
			userId,
			workspace: data.workspace,
			typeStyles: data.typeStyles,
			activePresetId: data.activePresetId,
		});

		// Insert user presets
		if (data.userPresets.length > 0) {
			await tx.insert(deskThemePreset).values(
				data.userPresets.map((p) => ({
					id: createId.themePreset(),
					userId,
					name: p.name,
					workspace: p.workspace,
					typeStyles: p.typeStyles,
				})),
			);
		}

		return true;
	});
}
