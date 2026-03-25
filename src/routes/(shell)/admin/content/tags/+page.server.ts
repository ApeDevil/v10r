import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	listTags, createTag, updateTag, deleteTag,
	listDomains, createDomain, updateDomain, deleteDomain,
} from '$lib/server/blog';
import { recordAuditEvent, getAuditContext } from '$lib/server/admin';
import type { Actions, PageServerLoad } from './$types';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const ICON_RE = /^i-(lucide|mdi|ph|tabler)-[a-z0-9-]+$/;

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [tags, domains] = await Promise.all([listTags(), listDomains()]);
	return { tags, domains };
};

export const actions: Actions = {
	create: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();
		const icon = (formData.get('icon') as string)?.trim() || null;
		const colorStr = formData.get('color') as string;
		const color = colorStr ? Number.parseInt(colorStr, 10) : null;
		const glyph = (formData.get('glyph') as string)?.trim() || null;

		if (!name) return fail(400, { message: 'Tag name is required.' });
		if (!slug) return fail(400, { message: 'Tag slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });
		if (icon && !ICON_RE.test(icon)) return fail(400, { message: 'Icon must be a valid icon class (e.g. i-lucide-code).' });
		if (color !== null && (Number.isNaN(color) || color < 1 || color > 8)) return fail(400, { message: 'Color must be 1-8.' });

		try {
			const tag = await createTag(name, slug, { icon, color, glyph });

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

	updateTag: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const tagId = formData.get('tagId') as string;
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();
		const icon = (formData.get('icon') as string)?.trim() || null;
		const colorStr = formData.get('color') as string;
		const color = colorStr ? Number.parseInt(colorStr, 10) : null;
		const glyph = (formData.get('glyph') as string)?.trim() || null;

		if (!tagId) return fail(400, { message: 'Tag ID required.' });
		if (!name) return fail(400, { message: 'Tag name is required.' });
		if (!slug) return fail(400, { message: 'Tag slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });
		if (icon && !ICON_RE.test(icon)) return fail(400, { message: 'Icon must be a valid icon class (e.g. i-lucide-code).' });
		if (color !== null && (Number.isNaN(color) || color < 1 || color > 8)) return fail(400, { message: 'Color must be 1-8.' });

		try {
			const updated = await updateTag(tagId, { name, slug, icon, color, glyph });
			if (!updated) return fail(404, { message: 'Tag not found.' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.tag.update',
				targetType: 'tag',
				targetId: tagId,
				detail: { name, slug, icon, color, glyph },
			});

			return { success: true, message: `Tag "${name}" updated.` };
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

	// ── Domain actions ─────────────────────────────────────────────

	createDomain: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();
		const icon = (formData.get('icon') as string)?.trim() || null;
		const colorStr = formData.get('color') as string;
		const color = colorStr ? Number.parseInt(colorStr, 10) : null;
		const description = (formData.get('description') as string)?.trim() || null;

		if (!name) return fail(400, { message: 'Domain name is required.' });
		if (!slug) return fail(400, { message: 'Domain slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });
		if (icon && !ICON_RE.test(icon)) return fail(400, { message: 'Icon must be a valid icon class (e.g. i-lucide-code).' });
		if (color !== null && (Number.isNaN(color) || color < 1 || color > 8)) return fail(400, { message: 'Color must be 1-8.' });

		try {
			const domain = await createDomain(name, slug, { icon, color, description });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.domain.create',
				targetType: 'domain',
				targetId: domain.id,
				detail: { name, slug, icon, color },
			});

			return { success: true, message: `Domain "${name}" created.` };
		} catch (e) {
			if (e instanceof Error && e.message.includes('unique')) {
				return fail(400, { message: 'Domain slug already exists.' });
			}
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to create domain.' });
		}
	},

	updateDomain: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const domainId = formData.get('domainId') as string;
		const name = (formData.get('name') as string)?.trim();
		const slug = (formData.get('slug') as string)?.trim();
		const icon = (formData.get('icon') as string)?.trim() || null;
		const colorStr = formData.get('color') as string;
		const color = colorStr ? Number.parseInt(colorStr, 10) : null;
		const description = (formData.get('description') as string)?.trim() || null;

		if (!domainId) return fail(400, { message: 'Domain ID required.' });
		if (!name) return fail(400, { message: 'Domain name is required.' });
		if (!slug) return fail(400, { message: 'Domain slug is required.' });
		if (!SLUG_RE.test(slug)) return fail(400, { message: 'Slug must be lowercase alphanumeric with hyphens.' });
		if (icon && !ICON_RE.test(icon)) return fail(400, { message: 'Icon must be a valid icon class (e.g. i-lucide-code).' });
		if (color !== null && (Number.isNaN(color) || color < 1 || color > 8)) return fail(400, { message: 'Color must be 1-8.' });

		try {
			const updated = await updateDomain(domainId, { name, slug, icon, color, description });
			if (!updated) return fail(404, { message: 'Domain not found.' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.domain.update',
				targetType: 'domain',
				targetId: domainId,
				detail: { name, slug, icon, color },
			});

			return { success: true, message: `Domain "${name}" updated.` };
		} catch (e) {
			if (e instanceof Error && e.message.includes('unique')) {
				return fail(400, { message: 'Domain slug already exists.' });
			}
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to update domain.' });
		}
	},

	deleteDomain: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const domainId = formData.get('domainId') as string;

		if (!domainId) return fail(400, { message: 'Domain ID required.' });

		try {
			const deleted = await deleteDomain(domainId);
			if (!deleted) return fail(404, { message: 'Domain not found.' });

			const ctx = getAuditContext(event);
			await recordAuditEvent({
				...ctx,
				action: 'blog.domain.delete',
				targetType: 'domain',
				targetId: domainId,
			});

			return { success: true, message: 'Domain deleted.' };
		} catch (e) {
			return fail(500, { message: e instanceof Error ? e.message : 'Failed to delete domain.' });
		}
	},
};
