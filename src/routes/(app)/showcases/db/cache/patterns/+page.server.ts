import { fail } from '@sveltejs/kit';
import { classifyCacheError } from '$lib/server/cache/errors';
import {
	addToSortedSet,
	decrementCounter,
	deleteHashField,
	deleteKey,
	incrementCounter,
	popFromList,
	pushToList,
	removeFromSortedSet,
	setHashField,
	setString,
} from '$lib/server/cache/showcase/mutations';
import { getEntryDetail, getShowcaseStats, listShowcaseEntries } from '$lib/server/cache/showcase/queries';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const [entries, stats] = await Promise.all([listShowcaseEntries(), getShowcaseStats()]);

		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return { title: 'Patterns - Cache - Showcases', entries, stats, queryMs };
	} catch (err) {
		const cacheErr = classifyCacheError(err);
		return {
			entries: [],
			stats: { keyCount: 0, keysByType: {} },
			queryMs: Math.round((performance.now() - start) * 100) / 100,
			error: cacheErr.message,
		};
	}
};

export const actions: Actions = {
	inspect: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			const detail = await getEntryDetail(key);
			if (!detail) return fail(404, { message: 'Key not found.' });
			return { success: true, detail };
		} catch (err) {
			return fail(500, { message: err instanceof Error ? err.message : 'Inspect failed.' });
		}
	},

	setString: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const value = formData.get('value') as string;
		const ttlStr = formData.get('ttl') as string;
		if (!key || !value) return fail(400, { message: 'Key and value are required.' });

		try {
			const ttl = ttlStr ? parseInt(ttlStr, 10) : undefined;
			await setString(key, value, ttl);
			return { success: true, message: `Set "${key}" successfully.` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	deleteEntry: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			await deleteKey(key);
			return { success: true, message: `Deleted "${key}".` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	increment: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const amount = parseInt(formData.get('amount') as string, 10) || 1;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			const value = await incrementCounter(key, amount);
			return { success: true, counterValue: value };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	decrement: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const amount = parseInt(formData.get('amount') as string, 10) || 1;
		if (!key) return fail(400, { message: 'No key specified.' });

		try {
			const value = await decrementCounter(key, amount);
			return { success: true, counterValue: value };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	setField: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const field = formData.get('field') as string;
		const value = formData.get('value') as string;
		if (!key || !field || !value) return fail(400, { message: 'Key, field, and value are required.' });

		try {
			await setHashField(key, field, value);
			return { success: true, message: `Set ${field} on "${key}".` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	deleteField: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const field = formData.get('field') as string;
		if (!key || !field) return fail(400, { message: 'Key and field are required.' });

		try {
			await deleteHashField(key, field);
			return { success: true, message: `Deleted field ${field} from "${key}".` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	addMember: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const member = formData.get('member') as string;
		const score = parseFloat(formData.get('score') as string);
		if (!key || !member || Number.isNaN(score)) return fail(400, { message: 'Key, member, and score are required.' });

		try {
			await addToSortedSet(key, member, score);
			return { success: true, message: `Added "${member}" with score ${score}.` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	removeMember: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const member = formData.get('member') as string;
		if (!key || !member) return fail(400, { message: 'Key and member are required.' });

		try {
			await removeFromSortedSet(key, member);
			return { success: true, message: `Removed "${member}".` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	pushItem: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const value = formData.get('value') as string;
		const side = (formData.get('side') as 'left' | 'right') || 'right';
		if (!key || !value) return fail(400, { message: 'Key and value are required.' });

		try {
			await pushToList(key, value, side);
			return { success: true, message: `Pushed to ${side} of "${key}".` };
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},

	popItem: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const side = (formData.get('side') as 'left' | 'right') || 'left';
		if (!key) return fail(400, { message: 'Key is required.' });

		try {
			const value = await popFromList(key, side);
			return {
				success: true,
				poppedValue: value,
				message: value ? `Popped "${value}" from ${side}.` : 'List is empty.',
			};
		} catch (err) {
			const cacheErr = classifyCacheError(err);
			return fail(400, { message: cacheErr.message });
		}
	},
};
