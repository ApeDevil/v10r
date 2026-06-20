/**
 * Script-side db + R2 helpers. Mirrors `src/lib/server/db/index.ts` and
 * `src/lib/server/store/index.ts` but reads `process.env` directly so it works
 * outside the SvelteKit runtime (no `$env/dynamic/private` resolution required).
 */

import { S3Client } from '@aws-sdk/client-s3';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../src/lib/server/db/schema';
import * as relations from '../../src/lib/server/db/schema/relations';

neonConfig.poolQueryViaFetch = true;

const url = process.env.NEON_DATABASE_URL_PROD;
if (!url) {
	console.error('NEON_DATABASE_URL_PROD not set');
	process.exit(1);
}

export const pool = new Pool({ connectionString: url });
export const db = drizzle(pool, { schema: { ...schema, ...relations } });

/** R2 helper: returns null when any required env var is missing (push will skip relative-asset uploads). */
export function createR2(): { s3: S3Client; bucket: string } | null {
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const bucket = process.env.R2_BUCKET_NAME;
	if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
	const s3 = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
	});
	return { s3, bucket };
}
