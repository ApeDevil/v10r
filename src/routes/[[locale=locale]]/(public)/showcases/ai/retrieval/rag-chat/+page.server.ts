import type { PageServerLoad } from './$types';

// configured check is provided by retrieval/+layout.server.ts
export const load: PageServerLoad = async ({ locals }) => ({
	title: 'RAG Chat - Retrieval - AI - Showcases',
	// Server truth for the sign-in gate — fresher than any client-side context copy.
	signedIn: !!locals.user,
});
