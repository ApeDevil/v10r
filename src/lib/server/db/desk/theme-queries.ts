import { eq } from 'drizzle-orm';
import { db } from '../index';
import { deskTheme, deskThemePreset } from '../schema/desk';
import type { WorkspaceColorsJson, TypeStylesJson } from '../schema/desk/theme';

export interface DeskThemeRow {
	userId: string;
	workspace: WorkspaceColorsJson;
	typeStyles: TypeStylesJson;
	activePresetId: string | null;
}

export interface DeskThemePresetRow {
	id: string;
	userId: string;
	name: string;
	workspace: WorkspaceColorsJson;
	typeStyles: TypeStylesJson;
}

/** Get a user's active desk theme. Returns null if none saved. */
export async function getDeskTheme(userId: string): Promise<DeskThemeRow | null> {
	const [row] = await db
		.select()
		.from(deskTheme)
		.where(eq(deskTheme.userId, userId))
		.limit(1);
	return row ?? null;
}

/** List all user-created presets for a user. */
export async function listDeskPresets(userId: string): Promise<DeskThemePresetRow[]> {
	return db
		.select({
			id: deskThemePreset.id,
			userId: deskThemePreset.userId,
			name: deskThemePreset.name,
			workspace: deskThemePreset.workspace,
			typeStyles: deskThemePreset.typeStyles,
		})
		.from(deskThemePreset)
		.where(eq(deskThemePreset.userId, userId));
}
