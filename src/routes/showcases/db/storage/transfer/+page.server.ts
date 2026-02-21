import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { generateUploadUrl, confirmUpload } from '$lib/server/store/showcase/mutations';
import { getObjectRange } from '$lib/server/store/showcase/queries';
import { classifyS3Error } from '$lib/server/store/errors';
import { formatBytes } from '$lib/server/store/types';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	requestUploadUrl: async ({ request }) => {
		const formData = await request.formData();
		const fileName = formData.get('fileName') as string;
		const mimeType = formData.get('mimeType') as string;
		const fileSize = Number(formData.get('fileSize') || 0);

		if (!fileName || !mimeType) {
			return fail(400, { message: 'Missing file info' });
		}

		try {
			const result = await generateUploadUrl(fileName, mimeType, fileSize);
			return { uploadUrl: result };
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return fail(400, { message: storeErr.message });
		}
	},

	confirmUpload: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;

		if (!key) return fail(400, { message: 'Missing key' });

		try {
			const result = await confirmUpload(key);
			return {
				confirmed: {
					...result,
					sizeFormatted: formatBytes(result.size),
				},
			};
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return fail(500, { message: storeErr.message });
		}
	},

	fetchRange: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const start = Number(formData.get('start') || 0);
		const end = Number(formData.get('end') || 63);

		if (!key) return fail(400, { message: 'Missing key' });

		// Limit range to 1024 bytes
		if (end - start > 1024) {
			return fail(400, { message: 'Range too large (max 1024 bytes)' });
		}

		try {
			const result = await getObjectRange(key, start, end);

			// Convert to hex dump
			const lines: string[] = [];
			for (let i = 0; i < result.data.length; i += 16) {
				const addr = (start + i).toString(16).padStart(8, '0');
				const bytes = Array.from(result.data.slice(i, i + 16));
				const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
				const ascii = bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
				lines.push(`${addr}  ${hex.padEnd(47)}  |${ascii}|`);
			}

			return {
				range: {
					contentRange: result.contentRange,
					contentLength: result.contentLength,
					hexDump: lines.join('\n'),
				},
			};
		} catch (err) {
			const storeErr = classifyS3Error(err);
			return fail(500, { message: storeErr.message });
		}
	},
};
