/**
 * Seed/backfill blog domains with DE/RU translations in JSONB.
 * Uses slug as conflict target so existing rows are backfilled in place.
 * Idempotent.
 */
import { domain } from '../schema/blog/post';
import type { SeedDb } from './index';

export async function seedBlogDomains(db: SeedDb) {
	const rows = [
		{
			id: 'dom_seed_engineering',
			slug: 'engineering',
			name: 'Engineering',
			description: 'Posts about software architecture, infrastructure, and tooling.',
			color: 1,
			nameI18n: { de: 'Technik', ru: 'Инженерия' },
			descriptionI18n: {
				de: 'Beiträge über Softwarearchitektur, Infrastruktur und Werkzeuge.',
				ru: 'Статьи об архитектуре ПО, инфраструктуре и инструментах.',
			},
		},
		{
			id: 'dom_seed_design',
			slug: 'design',
			name: 'Design',
			description: 'Posts about visual design, typography, and product craft.',
			color: 4,
			nameI18n: { de: 'Design', ru: 'Дизайн' },
			descriptionI18n: {
				de: 'Beiträge über visuelles Design, Typografie und Produktqualität.',
				ru: 'Статьи о визуальном дизайне, типографике и проработке продукта.',
			},
		},
	];

	for (const row of rows) {
		await db
			.insert(domain)
			.values(row)
			.onConflictDoUpdate({
				target: domain.slug,
				set: {
					name: row.name,
					description: row.description,
					color: row.color,
					nameI18n: row.nameI18n,
					descriptionI18n: row.descriptionI18n,
				},
			});
	}
}
