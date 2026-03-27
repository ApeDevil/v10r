import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/app/dashboard';

function sanitizeReturnTo(raw: string | null): string {
	if (!raw) return DEFAULT_REDIRECT;
	if (!raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_REDIRECT;
	try {
		const parsed = new URL(raw, 'http://localhost');
		if (parsed.origin !== 'http://localhost') return DEFAULT_REDIRECT;
		return parsed.pathname + parsed.search;
	} catch {
		return DEFAULT_REDIRECT;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		redirect(303, sanitizeReturnTo(url.searchParams.get('returnTo')));
	}

	const email = url.searchParams.get('email');
	if (!email) {
		redirect(303, '/auth/login');
	}

	return {
		email,
		returnTo: sanitizeReturnTo(url.searchParams.get('returnTo')),
	};
};
