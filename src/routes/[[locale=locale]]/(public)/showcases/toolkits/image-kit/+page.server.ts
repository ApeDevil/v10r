/**
 * Not localized: every user-facing string below is a literal or a humanized
 * enum key. The whole file still needs an i18n pass — no per-string markers.
 */
import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/i18n';
import { getVisionProvider } from '$lib/server/ai';
import { ImageMetaError } from '$lib/server/imagemeta';
import { estimatePreRunCost, ingestEphemeralImage } from '$lib/server/showcases/image-kit';
import { getImagekitReadUrl } from '$lib/server/showcases/image-kit/storage';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));

	const provider = getVisionProvider(locals.user.id);
	return {
		title: 'Image Kit - Toolkits - Showcases',
		aiAvailable: !!provider,
	};
};

export const actions: Actions = {
	/**
	 * Multipart upload → ephemeral ingest (validate/process/store, NO DB row) →
	 * presigned preview URL + a pre-run cost estimate. The client wires the returned
	 * imageId into its state and gates the Run button on it.
	 */
	upload: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const file = formData.get('image');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { uploadError: 'Choose an image to upload.' });
		}

		try {
			const result = await ingestEphemeralImage(locals.user.id, file);
			const previewUrl = await getImagekitReadUrl(result.storageKey);
			const provider = getVisionProvider(locals.user.id);
			const estimate = provider
				? estimatePreRunCost(provider.model, { width: result.width, height: result.height })
				: null;

			return {
				uploaded: {
					imageId: result.imageId,
					previewUrl,
					width: result.width,
					height: result.height,
					fileSize: result.fileSize,
					estimate,
				},
			};
		} catch (err) {
			if (err instanceof ImageMetaError) {
				return fail(err.toStatus(), { uploadError: err.message });
			}
			throw err;
		}
	},
};
