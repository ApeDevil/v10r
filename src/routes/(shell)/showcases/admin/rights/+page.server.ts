import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		controllerEmail: env.ADMIN_EMAIL ?? 'stas-k@gmx.de',
	};
};
