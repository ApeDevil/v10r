/**
 * Seed/backfill blog tags with DE/RU translations in JSONB.
 * Uses slug as conflict target so existing rows are backfilled in place.
 * Idempotent.
 */
import { tag } from '../schema/blog/tag';
import type { SeedDb } from './index';

export async function seedBlogTags(db: SeedDb) {
	const rows = [
		{
			id: 'tag_seed_typography',
			slug: 'typography',
			name: 'Typography',
			color: 2,
			nameI18n: { de: 'Typografie', ru: 'Типографика' },
		},
		{
			id: 'tag_seed_architecture',
			slug: 'architecture',
			name: 'Architecture',
			color: 3,
			nameI18n: { de: 'Architektur', ru: 'Архитектура' },
		},
		{
			id: 'tag_seed_performance',
			slug: 'performance',
			name: 'Performance',
			color: 5,
			nameI18n: { de: 'Leistung', ru: 'Производительность' },
		},
		{
			id: 'tag_seed_tutorial',
			slug: 'tutorial',
			name: 'Tutorial',
			color: 6,
			nameI18n: { de: 'Anleitung', ru: 'Руководство' },
		},
	];

	for (const row of rows) {
		await db
			.insert(tag)
			.values(row)
			.onConflictDoUpdate({
				target: tag.slug,
				set: {
					name: row.name,
					color: row.color,
					nameI18n: row.nameI18n,
				},
			});
	}
}
