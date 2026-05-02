import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	auditLog,
	collectionShelf,
	documentVault,
	networkRegistry,
	rangeBooking,
	temporalRecord,
	typeSpecimen,
} from '$lib/server/db/schema';
import { reseedShowcase } from '$lib/server/db/showcase/seed';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [specimens, temporals, documents, collections, networks, bookings, audits] = await Promise.all([
			db.select().from(typeSpecimen),
			db.select().from(temporalRecord),
			db.select().from(documentVault).where(sql`deleted_at IS NULL`),
			db.select().from(collectionShelf),
			db.select().from(networkRegistry),
			db.select().from(rangeBooking),
			db.select().from(auditLog).orderBy(sql`occurred_at DESC`),
		]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			title: 'Type System - Relational - Showcases',
			specimens,
			temporals,
			documents,
			collections,
			networks,
			bookings,
			audits,
			queryMs,
		};
	} catch (err) {
		return {
			specimens: [],
			temporals: [],
			documents: [],
			collections: [],
			networks: [],
			bookings: [],
			audits: [],
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			error: err instanceof Error ? err.message : 'Unknown database error',
		};
	}
};

export const actions: Actions = {
	reseed: async () => {
		try {
			await reseedShowcase(db);
			return { success: true, message: 'Showcase data reset to seed values.' };
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Failed to reseed.',
			});
		}
	},
};
