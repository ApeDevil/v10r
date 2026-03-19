import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { brandSettingsSchema } from '$lib/schemas/app/branding';
import { requireAdmin } from '$lib/server/auth/guards';
import { getBrandSettings, upsertBrandSettings } from '$lib/server/db/brand/queries';
import { invalidateCorporateCache } from '$lib/server/style/corporate';
import { PALETTE_REGISTRY } from '$lib/styles/random/palette-registry';
import { RADIUS_REGISTRY } from '$lib/styles/random/radius-registry';
import { TYPOGRAPHY_REGISTRY } from '$lib/styles/random/typography-registry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const row = await getBrandSettings();

	const form = await superValidate(
		row
			? {
					paletteId: row.paletteId,
					typographyId: row.typographyId,
					radiusId: row.radiusId,
					enabled: row.enabled,
				}
			: {
					paletteId: 'P1',
					typographyId: 'T1',
					radiusId: 'R2',
					enabled: false,
				},
		valibot(brandSettingsSchema),
	);

	return {
		form,
		palettes: PALETTE_REGISTRY.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			swatches: {
				primary: p.light.primary,
				bg: p.light.bg,
				fg: p.light.fg,
				muted: p.light.muted,
				accent: p.light['primary-light'],
			},
		})),
		typographySets: TYPOGRAPHY_REGISTRY.map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			heading: t.heading,
			body: t.body,
		})),
		radiusSets: RADIUS_REGISTRY.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
		})),
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals);

		const form = await superValidate(request, valibot(brandSettingsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await upsertBrandSettings(form.data);
		invalidateCorporateCache();

		return message(form, 'Brand settings saved.');
	},
};
