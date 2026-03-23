import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/guards';
import { listTags, createTag, renameTag, deleteTag } from '$lib/server/blog';
import { recordAuditEvent, getAuditContext } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const tags = await listTags();
	return { tags };
};

export const actions: Actions = {
	create: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();

		if (!name) return fail(400, { message: 'Tag name is required.' });
		if (!slug) return fail(400, { message: 'Tag slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });

		try {
			const tag = await createTag(name, slug);

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.tag.create',
				targetType: 'tag',
				targetId: tag.id,
				detail: { name, slug },
			});

			return { success: true, message: `Tag "${name}" created.` };
		} catch (e) {
			if (e instanceof Error && e.message.includes('unique')) {
				return fail(400, { message: 'Tag slug already exists.' });
			}
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to create tag.' });
		}
	},

	rename: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const tagId = formData.get('tagId') as string;
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();

		if (!tagId) return fail(400, { message: 'Tag ID required.' });
		if (!name) return fail(400, { message: 'Tag name is required.' });
		if (!slug) return fail(400, { message: 'Tag slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });

		try {
			const updated = await renameTag(tagId, { name, slug });
			if (!updated) return fail(404, { message: 'Tag not found.' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.tag.rename',
				targetType: 'tag',
				targetId: tagId,
				detail: { name, slug },
			});

			return { success: true, message: `Tag renamed to "${name}".` };
		} catch (e) {
			if (e instanceof Error && e.message.includes('unique')) {
				return fail(400, { message: 'Tag slug already exists.' });
			}
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to rename tag.' });
		}
	},

	delete: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const tagId = formData.get('tagId') as string;

		if (!tagId) return fail(400, { message: 'Tag ID required.' });

		try {
			const deleted = await deleteTag(tagId);
			if (!deleted) return fail(404, { message: 'Tag not found.' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.tag.delete',
				targetType: 'tag',
				targetId: tagId,
			});

			return { success: true, message: 'Tag deleted.' };
		} catch (e) {
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to delete tag.' });
		}
	},
};
