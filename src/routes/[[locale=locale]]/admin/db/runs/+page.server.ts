import { count, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dbopsOperation } from '$lib/server/db/schema/dbops/operation';
import { requireAdmin } from '$lib/server/http/guards';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url, depends, locals }) => {
	requireAdmin(locals);
	depends('admin:dbops');

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const offset = (page - 1) * PAGE_SIZE;

	const [history, totalResult] = await Promise.all([
		db.select().from(dbopsOperation).orderBy(desc(dbopsOperation.createdAt)).limit(PAGE_SIZE).offset(offset),
		db.select({ total: count() }).from(dbopsOperation),
	]);

	const total = totalResult[0]?.total ?? 0;

	return {
		history: history.map((h) => ({
			id: h.id,
			kind: h.kind,
			status: h.status,
			trigger: h.trigger,
			actorEmail: h.actorEmail,
			neonOpCount: h.neonOperationIds.length,
			errorMessage: h.error?.message ?? null,
			createdAt: h.createdAt.toISOString(),
			durationMs: h.finishedAt ? h.finishedAt.getTime() - h.createdAt.getTime() : null,
		})),
		page,
		totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
	};
};
