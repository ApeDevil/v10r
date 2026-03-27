import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { brandSettingsSchema, customPaletteSchema } from '$lib/schemas/app/branding';
import * as v from 'valibot';
import { requireAdmin } from '$lib/server/auth/guards';
import { recordAuditEvent, getAuditContext } from '$lib/server/admin';
import { getBrandSettings, upsertBrandSettings } from '$lib/server/db/brand/queries';
import {
	createCustomPalette,
	deleteCustomPalette,
	listCustomPalettes,
	updateCustomPalette,
} from '$lib/server/branding/palette-crud';
import { invalidateBrandCache } from '$lib/server/style/brand';
import { PALETTE_REGISTRY } from '$lib/styles/random/palette-registry';
import { RADIUS_REGISTRY } from '$lib/styles/random/radius-registry';
import { TYPOGRAPHY_REGISTRY } from '$lib/styles/random/typography-registry';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const row = await getBrandSettings();
	const customPalettes = locals.user ? await listCustomPalettes(locals.user.id) : [];

	const initialData = row
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
			};

	const form = await superValidate(initialData as Record<string, unknown>, valibot(brandSettingsSchema));

	return {
		form,
		customPalettes,
		palettes: PALETTE_REGISTRY.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			swatches: {
				primary: p.light.primary,
				bg: p.light.bg,
				fg: p.light.fg,
				muted: p.light.muted,
				accent: p.light.accent ?? p.light['primary-dim'],
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
	saveBrandSettings: async (event) => {
		requireAdmin(event.locals);

		const form = await superValidate(event.request, valibot(brandSettingsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await upsertBrandSettings(form.data);
		invalidateBrandCache();

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'branding.update',
			targetType: 'brand_settings',
			detail: { ...form.data },
		});

		return message(
			form,
			form.data.enabled
				? 'Visual identity locked — all visitors see your brand.'
				: 'Settings saved. Visual identity is unlocked — visitors still see random styles.',
		);
	},

	saveCustomPalette: async (event) => {
		requireAdmin(event.locals);
		const locals = event.locals;
		const formData = await event.request.formData();
		const raw = formData.get('paletteData');
		if (!raw || typeof raw !== 'string') return fail(400, { error: 'Missing palette data' });

		let data: v.InferOutput<typeof customPaletteSchema>;
		try {
			data = v.parse(customPaletteSchema, JSON.parse(raw));
		} catch (e) {
			if (e instanceof v.ValiError) {
				return fail(400, { error: 'Invalid palette data' });
			}
			return fail(400, { error: 'Invalid JSON' });
		}

		const id = formData.get('paletteId') as string | null;
		try {
			const ctx = getAuditContext(event);
			if (id) {
				await updateCustomPalette(id, locals.user!.id, {
					name: data.name,
					description: data.description,
					lightColors: data.lightColors,
					darkColors: data.darkColors,
				});
				await recordAuditEvent({
					...ctx,
					action: 'palette.update',
					targetType: 'custom_palette',
					targetId: id,
					detail: { name: data.name },
				});
				return { success: true, paletteId: id };
			} else {
				const palette = await createCustomPalette({
					name: data.name,
					description: data.description ?? '',
					basePaletteId: data.basePaletteId,
					lightColors: data.lightColors,
					darkColors: data.darkColors,
					createdBy: locals.user!.id,
				});
				await recordAuditEvent({
					...ctx,
					action: 'palette.create',
					targetType: 'custom_palette',
					targetId: palette.id,
					detail: { name: data.name },
				});
				return { success: true, paletteId: palette.id };
			}
		} catch {
			return fail(500, { error: 'Failed to save palette' });
		}
	},

	deleteCustomPalette: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const id = formData.get('paletteId') as string;
		if (!id) return fail(400, { error: 'Missing palette ID' });

		try {
			await deleteCustomPalette(id, event.locals.user!.id);
			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'palette.delete',
				targetType: 'custom_palette',
				targetId: id,
			});
		} catch {
			return fail(500, { error: 'Failed to delete palette' });
		}
		return { success: true };
	},
};
