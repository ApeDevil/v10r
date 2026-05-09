#!/usr/bin/env bun
/**
 * Throwaway: seed an `announcements` blog domain so the smoke test can publish.
 * Drop after the project has its own domain seeding story.
 */
import { eq } from 'drizzle-orm';
import { domain } from '../../src/lib/server/db/schema/blog';
import { db, pool } from './_db';

const slug = 'announcements';
const [existing] = await db.select().from(domain).where(eq(domain.slug, slug)).limit(1);
if (existing) {
	console.log(`[_seed-domain] '${slug}' already exists (${existing.id})`);
} else {
	await db.insert(domain).values({
		id: `dom_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
		slug,
		name: 'Announcements',
		description: 'Project-wide announcements and changelog notes.',
	});
	console.log(`[_seed-domain] created '${slug}'`);
}
await pool.end();
