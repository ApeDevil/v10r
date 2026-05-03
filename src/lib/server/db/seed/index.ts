/**
 * Seed orchestrator. Each seed function is idempotent (onConflictDoUpdate).
 * Pass an active drizzle db. Order matters: domains before revisions
 * (revisions reference dom_seed_engineering as their domainId).
 */
import type { Pool } from '@neondatabase/serverless';
import type { drizzle } from 'drizzle-orm/neon-serverless';
import { seedAnnouncements } from './announcements';
import { seedBlogDomains } from './blog-domains';
import { seedBlogRevisions } from './blog-revisions';
import { seedBlogTags } from './blog-tags';

export type SeedDb = ReturnType<typeof drizzle<Record<string, never>, Pool>>;

export async function runSeed(db: SeedDb): Promise<void> {
	await seedBlogDomains(db);
	await seedBlogTags(db);
	await seedBlogRevisions(db);
	await seedAnnouncements(db);
}
