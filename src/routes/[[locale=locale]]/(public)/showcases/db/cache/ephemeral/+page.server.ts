import { fail } from '@sveltejs/kit';
import { classifyCacheError } from '$lib/server/cache/errors';
import { setString, slideTtl } from '$lib/server/cache/showcase/mutations';
import { checkRateLimit, getTtlSnapshot, listShowcaseEntries } from '$lib/server/cache/showcase/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const allEntries = await listShowcaseEntries();
		// Filter to TTL entries (those with positive TTL or the ttl: namespace)
		const ttlEntries = allEntries.filter((e) => e.key.includes(':ttl:') || e.ttl > 0);

		const snapshots = await Promise.all(ttlEntries.map((e) => getTtlSnapshot(e.key)));

		return { title: 'Ephemeral - Cache - Showcases', snapshots };
	} catch (err) {
		const cacheErr = classifyCacheError(err);
		return { snapshots: [], error: cacheErr.message };
	}
};

export const actions: Actions = {
	createTtl: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const value = formData.get('value') as string;
		const ttl = parseInt(formData.get('ttl') as string, 10);
		if (!key || !value || Number.isNaN(ttl) || ttl <= 0) {
			return fail(400, { message: 'Key, value, and positive TTL are required.' });
		}

		try {
			await setString(key, value, ttl);
			return { success: true, message: `Created "${key}" with ${ttl}s TTL.` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	checkTtl: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			const snapshot = await getTtlSnapshot(key);
			return { success: true, snapshot };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'TTL check failed.' });
		}
	},

	refreshTtl: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const seconds = parseInt(formData.get('seconds') as string, 10) || 300;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			const beforeSnapshot = await getTtlSnapshot(key);
			const newTtl = await slideTtl(key, seconds);
			const afterSnapshot = await getTtlSnapshot(key);
			return {
				success: true,
				before: beforeSnapshot,
				after: afterSnapshot,
				message: `TTL refreshed from ${beforeSnapshot.remainingSeconds}s to ${newTtl}s.`,
			};
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	rateCheck: async ({ request, getClientAddress }) => {
		const formData = await request.formData();
		const identifier = (formData.get('identifier') as string) || getClientAddress();
		const limit = parseInt(formData.get('limit') as string, 10) || 10;
		const window = parseInt(formData.get('window') as string, 10) || 10;

		try {
			const result = await checkRateLimit(identifier, limit, window);
			return { success: true, rateLimit: result };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'Rate limit check failed.' });
		}
	},
};
