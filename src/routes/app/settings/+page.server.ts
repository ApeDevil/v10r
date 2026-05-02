import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { userSettingsSchema } from '$lib/schemas/app/settings';
import { getOrCreatePreferences, updatePreferences } from '$lib/server/db/preferences/mutations';
import { updateDisplayName } from '$lib/server/db/user';
import { AVATAR_ERROR_MESSAGES, removeAvatar, uploadAvatar, validateAvatar } from '$lib/server/store/avatar';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/auth/login');

	const prefs = await getOrCreatePreferences(locals.user.id);

	const form = await superValidate(
		{
			displayName: locals.user.name,
			theme: prefs.theme as 'light' | 'dark' | 'system',
			displayDensity: prefs.displayDensity as 'compact' | 'comfortable' | 'spacious',
			locale: prefs.locale as 'en' | 'es' | 'fr' | 'de' | 'ja',
			timezone: prefs.timezone,
			dateFormat: prefs.dateFormat as 'relative' | 'absolute' | 'iso',
			sidebarWidth: prefs.sidebarWidth,
			reduceMotion: prefs.reduceMotion,
			highContrast: prefs.highContrast,
		},
		valibot(userSettingsSchema),
	);

	return { title: 'Settings', form, avatarUrl: locals.user.image };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const form = await superValidate(request, valibot(userSettingsSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { displayName, theme, sidebarWidth, ...prefsData } = form.data;

		// Update display name directly if changed
		if (displayName !== locals.user.name) {
			await updateDisplayName(locals.user.id, displayName);
		}

		// Update preferences
		await updatePreferences(locals.user.id, { theme, sidebarWidth, ...prefsData });

		// Write theme cookie for SSR FOUC prevention
		cookies.set('theme', theme, {
			path: '/',
			maxAge: 31536000,
			sameSite: 'lax',
			httpOnly: false,
		});

		// Write sidebar width cookie for SSR flash prevention
		cookies.set('sidebar-width', String(sidebarWidth), {
			path: '/',
			maxAge: 31536000,
			sameSite: 'lax',
			httpOnly: false,
		});

		return message(form, 'Settings saved.');
	},

	uploadAvatar: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		const formData = await request.formData();
		const file = formData.get('avatar') as File | null;

		const validationError = validateAvatar(file);
		if (validationError || !file) {
			const error = validationError ?? 'no_file';
			return fail(error === 'storage_unavailable' ? 503 : 400, {
				avatarError: AVATAR_ERROR_MESSAGES[error],
			});
		}

		const avatarUrl = await uploadAvatar(locals.user.id, file);
		return { avatarUrl };
	},

	removeAvatar: async ({ locals }) => {
		if (!locals.user) redirect(303, '/auth/login');
		await removeAvatar(locals.user.id, locals.user.image ?? null);
		return { avatarUrl: null };
	},
};
