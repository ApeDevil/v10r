import type { LayoutServerLoad } from './$types';
import { getDeskTheme, listDeskPresets } from '$lib/server/db/desk/theme-queries';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { deskTheme: null, deskPresets: [] };
	}

	const [theme, presets] = await Promise.all([
		getDeskTheme(locals.user.id),
		listDeskPresets(locals.user.id),
	]);

	return {
		deskTheme: theme
			? {
					workspace: theme.workspace,
					typeStyles: theme.typeStyles,
					activePresetId: theme.activePresetId,
				}
			: null,
		deskPresets: presets.map((p) => ({
			id: p.id,
			name: p.name,
			workspace: p.workspace,
			typeStyles: p.typeStyles,
		})),
	};
};
