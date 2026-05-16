import type { PageServerLoad } from './$types';

// configured check is provided by retrieval/+layout.server.ts
export const load: PageServerLoad = async () => ({ title: 'RAG Chat - Retrieval - AI - Showcases' });
