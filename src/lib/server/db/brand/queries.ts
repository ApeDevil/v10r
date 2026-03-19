import { eq } from 'drizzle-orm';
import { db } from '../index';
import { brandSettings } from '../schema/app/brand-settings';

const SINGLETON_ID = 'default';

/** Get the brand settings singleton row, or null if none exists. */
export async function getBrandSettings() {
	const [row] = await db.select().from(brandSettings).where(eq(brandSettings.id, SINGLETON_ID)).limit(1);
	return row ?? null;
}

/** Upsert brand settings — creates or updates the singleton row. */
export async function upsertBrandSettings(data: {
	paletteId: string;
	typographyId: string;
	radiusId: string;
	enabled: boolean;
}) {
	const [row] = await db
		.insert(brandSettings)
		.values({ id: SINGLETON_ID, ...data, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: brandSettings.id,
			set: { ...data, updatedAt: new Date() },
		})
		.returning();
	return row;
}
