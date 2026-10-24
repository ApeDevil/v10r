import { PRIVACY_CONTACT_EMAIL } from '$app/env/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		title: 'Your rights — Admin & Privacy',
		controllerEmail: PRIVACY_CONTACT_EMAIL ?? 'privacy@example.com',
	};
};
