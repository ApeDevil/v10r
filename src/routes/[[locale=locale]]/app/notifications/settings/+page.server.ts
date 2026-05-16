import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { localizeHref } from '$lib/i18n';
import { notificationSettingsSchema } from '$lib/schemas/app/notification-settings';
import { db } from '$lib/server/db';
import { getOrCreateSettings, updateSettings } from '$lib/server/db/notifications/mutations';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));
	const userId = locals.user.id;

	const [settings, telegramAccount, discordAccount] = await Promise.all([
		getOrCreateSettings(userId),
		db
			.select({
				telegramUsername: userTelegramAccounts.telegramUsername,
				isActive: userTelegramAccounts.isActive,
			})
			.from(userTelegramAccounts)
			.where(eq(userTelegramAccounts.userId, userId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		db
			.select({
				discordUsername: userDiscordAccounts.discordUsername,
				isActive: userDiscordAccounts.isActive,
			})
			.from(userDiscordAccounts)
			.where(eq(userDiscordAccounts.userId, userId))
			.limit(1)
			.then((rows) => rows[0] ?? null),
	]);

	const form = await superValidate(settings, valibot(notificationSettingsSchema));

	return {
		form,
		telegram: telegramAccount,
		discord: discordAccount,
		successMessage: url.searchParams.get('success'),
		errorMessage: url.searchParams.get('error'),
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const form = await superValidate(request, valibot(notificationSettingsSchema));
		if (!form.valid) return fail(400, { form });

		await updateSettings(locals.user.id, form.data);

		return message(form, 'Notification settings saved');
	},
};
