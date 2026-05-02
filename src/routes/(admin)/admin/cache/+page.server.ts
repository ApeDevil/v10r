import { fail } from '@sveltejs/kit';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import { adminDeleteKey, adminFlushByPrefix, adminInvalidateInProcessCaches } from '$lib/server/cache/admin/mutations';
import { getAllKeys, getCacheOverview, getInProcessCacheStatus, getKeyDetail } from '$lib/server/cache/admin/queries';
import { ADMIN_CACHE_PAGE_SIZE } from '$lib/server/config';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { Actions, PageServerLoad } from './$types';

const ALLOWED_FLUSH_PREFIXES = ['showcase:', 'ratelimit:'];

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const prefix = url.searchParams.get('prefix') || '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	let overview: Awaited<ReturnType<typeof getCacheOverview>> | null;
	let inProcessStatus: ReturnType<typeof getInProcessCacheStatus>;
	try {
		[overview, inProcessStatus] = await Promise.all([getCacheOverview(), Promise.resolve(getInProcessCacheStatus())]);
	} catch {
		overview = null;
		inProcessStatus = getInProcessCacheStatus();
	}

	return {
		title: 'Cache Inspector',
		overview,
		inProcessStatus,
		filters: { prefix, page },
		keys: safeDeferPromise(
			getAllKeys(prefix || undefined).then((allKeys) => {
				const start = (page - 1) * ADMIN_CACHE_PAGE_SIZE;
				const entries = allKeys.slice(start, start + ADMIN_CACHE_PAGE_SIZE);
				return {
					entries,
					total: allKeys.length,
					totalPages: Math.max(1, Math.ceil(allKeys.length / ADMIN_CACHE_PAGE_SIZE)),
				};
			}),
			{ entries: [], total: 0, totalPages: 1 },
		),
	};
};

export const actions: Actions = {
	deleteKey: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const key = formData.get('key') as string;

		if (!key) return fail(400, { message: 'Key required' });

		const deleted = await adminDeleteKey(key);
		if (!deleted) return fail(404, { message: 'Key not found' });

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'cache.key.delete',
			targetType: 'redis_key',
			targetId: key,
		});

		return { success: true, message: `Deleted key "${key}".` };
	},

	flushPrefix: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const prefix = formData.get('prefix') as string;

		if (!prefix || !ALLOWED_FLUSH_PREFIXES.includes(prefix)) {
			return fail(400, { message: `Invalid prefix. Allowed: ${ALLOWED_FLUSH_PREFIXES.join(', ')}` });
		}

		const count = await adminFlushByPrefix(prefix);

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'cache.flush',
			targetType: 'redis_prefix',
			targetId: prefix,
			detail: { count },
		});

		return { success: true, message: `Flushed ${count} key(s) with prefix "${prefix}".` };
	},

	invalidateInProcess: async (event) => {
		requireAdmin(event.locals);

		adminInvalidateInProcessCaches();

		const ctx = getAuditContext(event);
		await recordAuditEvent({
			...ctx,
			action: 'cache.invalidate_in_process',
			targetType: 'cache',
			targetId: 'in_process',
		});

		return { success: true, message: 'In-process caches invalidated.' };
	},

	inspectKey: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const key = formData.get('key') as string;

		if (!key) return fail(400, { message: 'Key required' });

		const detail = await getKeyDetail(key);
		if (!detail) return fail(404, { message: 'Key not found' });

		return { success: true, detail };
	},
};
