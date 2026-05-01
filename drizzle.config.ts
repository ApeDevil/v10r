import { neonConfig } from '@neondatabase/serverless';
import { defineConfig } from 'drizzle-kit';

// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Route drizzle-kit schema operations over HTTP fetch instead.
// https://github.com/drizzle-team/drizzle-orm/issues/4957
neonConfig.poolQueryViaFetch = true;

export default defineConfig({
	schema: './src/lib/server/db/schema',
	out: './drizzle',
	dialect: 'postgresql',
	schemaFilter: ['admin', 'showcase', 'auth', 'ai', 'rag', 'jobs', 'notifications', 'analytics', 'app', 'blog', 'desk', 'feedback'],
	dbCredentials: {
		url: process.env.DATABASE_URL ?? '',
	},
});
