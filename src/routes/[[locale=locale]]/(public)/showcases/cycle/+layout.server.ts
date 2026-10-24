import { desc } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { cycleRun } from '#lib/server/db/schema/index.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const history = await db.select().from(cycleRun).orderBy(desc(cycleRun.createdAt)).limit(20);
	return { history };
};
