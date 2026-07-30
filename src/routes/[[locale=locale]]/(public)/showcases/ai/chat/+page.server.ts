import { aiConfigured } from '$lib/server/ai';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Server truth for the sign-in gate — fresher than any client-side context copy.
	return { title: 'Chat - AI - Showcases', configured: aiConfigured, signedIn: !!locals.user };
};
