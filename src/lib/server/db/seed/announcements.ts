/**
 * Seed one active announcement with DE/RU translations in JSONB.
 * Idempotent via onConflictDoUpdate.
 */
import { announcements } from '../schema/admin/announcements';
import type { SeedDb } from './index';

const ANN_ID = 'ann_seed_welcome';

export async function seedAnnouncements(db: SeedDb) {
	const row = {
		id: ANN_ID,
		title: 'Welcome to v10r',
		body: 'This is a localized announcement. The banner renders in your active locale.',
		severity: 'info' as const,
		active: true,
		createdBy: 'system',
		titleI18n: {
			de: 'Willkommen bei v10r',
			ru: 'Добро пожаловать в v10r',
		},
		bodyI18n: {
			de: 'Das ist eine übersetzte Mitteilung. Der Banner erscheint in deiner aktiven Sprache.',
			ru: 'Это локализованное объявление. Баннер показывается на вашем активном языке.',
		},
	};

	await db
		.insert(announcements)
		.values(row)
		.onConflictDoUpdate({
			target: announcements.id,
			set: {
				title: row.title,
				body: row.body,
				severity: row.severity,
				active: row.active,
				titleI18n: row.titleI18n,
				bodyI18n: row.bodyI18n,
			},
		});
}
