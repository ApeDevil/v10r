import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { userSettingsSchema } from '$lib/schemas/app/settings';
import { MAX_UPLOAD_SIZE } from '$lib/server/config';
import { db } from '$lib/server/db';
import { getOrCreatePreferences, updatePreferences } from '$lib/server/db/preferences/mutations';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { BUCKET, s3 } from '$lib/server/store';
import type { Actions, PageServerLoad } from './$types';

const AVATAR_PREFIX = 'avatars/';
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

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

	return { form, avatarUrl: locals.user.image };
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
			await db.update(user).set({ name: displayName, updatedAt: new Date() }).where(eq(user.id, locals.user.id));
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
		if (!s3) return fail(503, { avatarError: 'Storage not configured' });

		const formData = await request.formData();
		const file = formData.get('avatar') as File | null;

		if (!file || file.size === 0) {
			return fail(400, { avatarError: 'No file selected' });
		}

		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			return fail(400, { avatarError: 'Only PNG, JPEG, GIF, and WebP images are allowed' });
		}

		if (file.size > MAX_UPLOAD_SIZE) {
			return fail(400, { avatarError: 'File must be under 2 MB' });
		}

		const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'bin';
		const key = `${AVATAR_PREFIX}${locals.user.id}.${ext}`;

		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: key,
				Body: Buffer.from(await file.arrayBuffer()),
				ContentType: file.type,
			}),
		);

		const avatarUrl = `/${key}`;

		await db.update(user).set({ image: avatarUrl, updatedAt: new Date() }).where(eq(user.id, locals.user.id));

		return { avatarUrl };
	},

	removeAvatar: async ({ locals }) => {
		if (!locals.user) redirect(303, '/auth/login');

		// Delete from R2 if exists
		if (s3 && locals.user.image?.startsWith(`/${AVATAR_PREFIX}`)) {
			const key = locals.user.image.slice(1); // Remove leading /
			await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
		}

		await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, locals.user.id));

		return { avatarUrl: null };
	},
};
