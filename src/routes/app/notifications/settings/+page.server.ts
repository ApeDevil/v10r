import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userTelegramAccounts } from '$lib/server/db/schema/notifications/telegram';
import { userDiscordAccounts } from '$lib/server/db/schema/notifications/discord';
import { getOrCreateSettings, updateSettings } from '$lib/server/db/notifications/mutations';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user!.id;

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

	return {
		settings,
		telegram: telegramAccount,
		discord: discordAccount,
		successMessage: url.searchParams.get('success'),
		errorMessage: url.searchParams.get('error'),
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();

		const data = {
			emailMention: formData.get('emailMention') === 'on',
			emailComment: formData.get('emailComment') === 'on',
			emailSystem: formData.get('emailSystem') === 'on',
			emailSuccess: formData.get('emailSuccess') === 'on',
			emailSecurity: formData.get('emailSecurity') === 'on',
			emailFollow: formData.get('emailFollow') === 'on',
			telegramMention: formData.get('telegramMention') === 'on',
			telegramComment: formData.get('telegramComment') === 'on',
			telegramSystem: formData.get('telegramSystem') === 'on',
			telegramSecurity: formData.get('telegramSecurity') === 'on',
			discordMention: formData.get('discordMention') === 'on',
			discordComment: formData.get('discordComment') === 'on',
			discordSystem: formData.get('discordSystem') === 'on',
			discordSecurity: formData.get('discordSecurity') === 'on',
			digestFrequency: formData.get('digestFrequency') as 'instant' | 'daily' | 'weekly' | 'never',
			quietStart: (formData.get('quietStart') as string) || null,
			quietEnd: (formData.get('quietEnd') as string) || null,
		};

		await updateSettings(locals.user.id, data);

		return { success: true };
	},
};
