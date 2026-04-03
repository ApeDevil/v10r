/**
 * One-time migration: backfill desk.file rows for existing desk.spreadsheet records.
 *
 * For each spreadsheet that has no file_id, creates a desk.file row and links them.
 * Safe to run multiple times — skips spreadsheets that already have a file_id.
 *
 * Usage:
 *   bun run scripts/migrate-desk-files.ts
 */
import { neonConfig, Pool } from '@neondatabase/serverless';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { file, fileTypeEnum } from '../src/lib/server/db/schema/desk/file';
import { spreadsheet } from '../src/lib/server/db/schema/desk/spreadsheet';
import { createId } from '../src/lib/server/db/id';

neonConfig.poolQueryViaFetch = true;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function migrate() {
	// Find spreadsheets without a file_id (not yet migrated)
	const orphans = await db
		.select({
			id: spreadsheet.id,
			userId: spreadsheet.userId,
			name: spreadsheet.name,
			createdAt: spreadsheet.createdAt,
			updatedAt: spreadsheet.updatedAt,
		})
		.from(spreadsheet)
		.where(isNull(spreadsheet.fileId));

	if (orphans.length === 0) {
		console.log('No spreadsheets to migrate — all already linked to desk.file.');
		return;
	}

	console.log(`Found ${orphans.length} spreadsheet(s) to migrate...`);

	let migrated = 0;
	for (const s of orphans) {
		const fileId = createId.file();

		await db.transaction(async (tx) => {
			// Create desk.file entry
			await tx.insert(file).values({
				id: fileId,
				userId: s.userId,
				type: 'spreadsheet',
				name: s.name,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			});

			// Link spreadsheet to file
			await tx
				.update(spreadsheet)
				.set({ fileId })
				.where(eq(spreadsheet.id, s.id));
		});

		migrated++;
		console.log(`  [${migrated}/${orphans.length}] ${s.name} (${s.id}) → ${fileId}`);
	}

	console.log(`\nMigration complete: ${migrated} spreadsheet(s) linked to desk.file.`);
}

migrate()
	.catch((err) => {
		console.error('Migration failed:', err);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});
