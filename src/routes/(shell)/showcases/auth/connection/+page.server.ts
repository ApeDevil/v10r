import { env } from '$env/dynamic/private';
import { BETTER_AUTH_URL, GITHUB_CLIENT_ID, MICROSOFT_CLIENT_ID } from '$env/static/private';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

async function measureAuth(headers: Headers) {
	const start = performance.now();

	try {
		const session = await auth.api.getSession({ headers });
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			reachable: true,
			latencyMs,
			authenticated: !!session?.user,
			userId: session?.user?.id ?? null,
			userName: session?.user?.name ?? null,
			userEmail: session?.user?.email ?? null,
			providers: {
				github: !!GITHUB_CLIENT_ID,
				google: !!env.GOOGLE_CLIENT_ID,
				microsoft: !!MICROSOFT_CLIENT_ID,
			},
			baseURL: BETTER_AUTH_URL,
			measuredAt: new Date().toISOString(),
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			reachable: false,
			latencyMs,
			authenticated: false,
			userId: null,
			userName: null,
			userEmail: null,
			providers: {
				github: !!GITHUB_CLIENT_ID,
				google: !!env.GOOGLE_CLIENT_ID,
				microsoft: !!MICROSOFT_CLIENT_ID,
			},
			baseURL: BETTER_AUTH_URL,
			error: err instanceof Error ? err.message : 'Unknown error',
			measuredAt: new Date().toISOString(),
		};
	}
}

export const load: PageServerLoad = async ({ request }) => {
	return measureAuth(request.headers);
};

export const actions: Actions = {
	retest: async ({ request }) => {
		return measureAuth(request.headers);
	},
};
