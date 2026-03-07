import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	listShowcaseObjects,
	getObjectDetail,
	generateDownloadUrl,
} from '$lib/server/store/showcase/queries';
import { classifyS3Error } from '$lib/server/store/errors';
import { formatBytes } from '$lib/server/store/types';

export const load: PageServerLoad = async () => {
	const start = performance.now();

	try {
		const objects = await listShowcaseObjects();
		const queryMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			objects: objects.map((o) => ({
				...o,
				sizeFormatted: formatBytes(o.size),
				lastModified: o.lastModified.toISOString(),
			})),
			queryMs,
		};
	} catch (err) {
		const storeErr = classifyS3Error(err);
		return { objects: [], queryMs: 0, error: storeErr.message };
	}
};

export const actions: Actions = {
	inspect: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;

		if (!key) return fail(400, { message: 'No key provided' });

		try {
			const detail = await getObjectDetail(key);
			return {
				detail: {
					...detail,
					sizeFormatted: formatBytes(detail.size),
					lastModified: detail.lastModified.toISOString(),
				},
			};
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return fail(500, { message: storeErr.message });
		}
	},

	presign: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const expiresIn = Number(formData.get('expiresIn') || 300);

		if (!key) return fail(400, { message: 'No key provided' });

		try {
			const result = await generateDownloadUrl(key, expiresIn);
			return { presigned: result };
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return fail(500, { message: storeErr.message });
		}
	},
};
