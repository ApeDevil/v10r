import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Your rights — Admin & Privacy',
		controllerEmail: env.PRIVACY_CONTACT_EMAIL ?? env.ADMIN_EMAIL ?? 'privacy@example.com',
	};
};
