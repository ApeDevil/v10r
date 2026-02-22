import { defineConfig } from 'drizzle-kit';
import { neonConfig } from '@neondatabase/serverless';

// Bun's ws implementation mishandles WebSocket upgrade (HTTP 101).
// Route drizzle-kit schema operations over HTTP fetch instead.
// https://github.com/drizzle-team/drizzle-orm/issues/4957
neonConfig.poolQueryViaFetch = true;

export default defineConfig({
	schema: './src/lib/server/db/schema',
	out: './drizzle',
	dialect: 'postgresql',
	schemaFilter: ['showcase', 'auth', 'ai'],
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
