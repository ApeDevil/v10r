import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Your rights — Admin & Privacy',
		controllerEmail: env.ADMIN_EMAIL ?? 'stas-k@gmx.de',
	};
};
