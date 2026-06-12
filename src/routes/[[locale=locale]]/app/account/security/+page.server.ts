import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { passkeysEnabled } from '$lib/server/auth';
import { listPasskeyDtos } from '$lib/server/db/user';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	if (!locals.user || !locals.session) redirect(303, localizeHref('/auth/login'));

	setHeaders({ 'Cache-Control': 'no-store, private' });

	const passkeys = passkeysEnabled ? await listPasskeyDtos(locals.user.id) : [];

	return {
		title: 'Security',
		passkeysEnabled,
		twoFactorEnabled: !!locals.user.twoFactorEnabled,
		passkeys: passkeys.map((p) => ({
			id: p.id,
			name: p.name,
			authenticatorLabel: p.authenticatorLabel,
			deviceType: p.deviceType,
			backedUp: p.backedUp,
			createdAt: p.createdAt?.toISOString() ?? null,
			lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
		})),
	};
};
