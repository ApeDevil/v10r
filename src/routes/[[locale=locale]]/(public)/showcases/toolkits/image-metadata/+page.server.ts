/**
 * Not localized: every user-facing string below is a literal or a humanized
 * enum key. The whole file still needs an i18n pass — no per-string markers.
 */
import { redirect } from '@sveltejs/kit';
import { fail, message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { localizeHref } from '$lib/i18n';
import {
	emptyImageMetadata,
	type FieldProvenance,
	imageMetadataSaveSchema,
	METADATA_FIELD_KEYS,
	PROVENANCE_STATES,
	type ProvenanceState,
} from '$lib/schemas/showcase/image-metadata';
import { getVisionProvider } from '$lib/server/ai';
import { ImageMetaError, ingestImage, saveImageMetadata } from '$lib/server/imagemeta';
import { getImagemetaReadUrl } from '$lib/server/store/showcase/image';
import type { Actions, PageServerLoad } from './$types';

/**
 * Defensively parse the `fieldProvenance` JSON hidden field into a complete
 * FieldProvenance record. Provenance is advisory audit metadata, not a
 * Superforms field — so a missing/garbage value must never block a save:
 * every key defaults to 'human' (the user is, after all, clicking save).
 */
function parseProvenance(raw: FormDataEntryValue | null): FieldProvenance {
	const out = {} as FieldProvenance;
	let parsed: Record<string, unknown> = {};
	if (typeof raw === 'string') {
		try {
			const candidate = JSON.parse(raw);
			if (candidate && typeof candidate === 'object') {
				parsed = candidate as Record<string, unknown>;
			}
		} catch {
			// fall through to all-'human' default
		}
	}
	const valid = new Set<ProvenanceState>(PROVENANCE_STATES);
	for (const key of METADATA_FIELD_KEYS) {
		const v = parsed[key];
		out[key] = typeof v === 'string' && valid.has(v as ProvenanceState) ? (v as ProvenanceState) : 'human';
	}
	return out;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login'));

	// Seed the always-usable manual form with blank defaults (no image yet).
	const form = await superValidate(emptyImageMetadata(''), valibot(imageMetadataSaveSchema));

	return {
		title: 'Image Metadata Reader - AI - Showcases',
		form,
		aiAvailable: !!getVisionProvider(locals.user.id),
	};
};

export const actions: Actions = {
	/**
	 * Multipart upload → ingest (validate/process/store) → presigned preview URL.
	 * Never touches the Superforms `form`; the client wires the returned imageId
	 * into the hidden field and reads exif for the GPS opt-in row.
	 */
	upload: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const file = formData.get('image');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { uploadError: 'Choose an image to upload.' });
		}

		try {
			const result = await ingestImage(locals.user.id, file);
			const previewUrl = await getImagemetaReadUrl(result.storageKey);

			return {
				uploaded: {
					imageId: result.imageId,
					previewUrl,
					width: result.width,
					height: result.height,
					exifGps: result.exif.gps,
					exifDate: result.exif.dateTimeOriginal,
				},
			};
		} catch (err) {
			if (err instanceof ImageMetaError) {
				return fail(err.toStatus(), { uploadError: err.message });
			}
			throw err;
		}
	},

	/**
	 * Validate against the strict save schema, then persist with provenance audit.
	 * `fieldProvenance` rides along as a JSON hidden field (NOT a Superforms
	 * nested field), parsed defensively above.
	 */
	save: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));

		const formData = await request.formData();
		const form = await superValidate(formData, valibot(imageMetadataSaveSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const provenance = parseProvenance(formData.get('fieldProvenance'));

		await saveImageMetadata(locals.user.id, form.data, provenance);

		return message(form, 'Metadata saved.');
	},
};
