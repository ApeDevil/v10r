import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const DEFAULT_REDIRECT = '/app/dashboard';

/** Validate returnTo is a safe relative path (no open redirect) */
function sanitizeReturnTo(raw: string | null): string {
	if (!raw) return DEFAULT_REDIRECT;
	// Must start with / but not // (protocol-relative)
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
	const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));

	// Already logged in → redirect to returnTo or dashboard
	if (locals.user) {
		redirect(303, returnTo);
	}

	return { returnTo };
};
