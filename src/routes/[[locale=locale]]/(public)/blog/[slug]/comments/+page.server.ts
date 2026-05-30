/**
 * Sub-route action target for comment writes.
 *
 * Lives at /blog/[slug]/comments so the parent slug page keeps its ISR
 * config unchanged — actions on the slug page would force it dynamic.
 *
 * `load` only exists to redirect direct GETs back to the slug page so a
 * bookmarked or shared `/comments` URL doesn't render an empty 500.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';
import { requireAuth } from '$lib/server/auth/guards';
import {
	CommentEditWindowExpiredError,
	CommentHiddenError,
	CommentNotFoundError,
	CommentNotOwnedError,
	CommentOnUnpublishedError,
	createComment,
	createCommentSchema,
	editCommentSchema,
	editOwnComment,
	getPostIdBySlug,
	softDeleteOwnComment,
} from '$lib/server/blog/comments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	redirect(303, `/blog/${params.slug}#comments`);
};

const editFormSchema = v.object({
	commentId: v.pipe(v.string(), v.minLength(1)),
	body: editCommentSchema.entries.body,
});
const deleteFormSchema = v.object({ commentId: v.pipe(v.string(), v.minLength(1)) });

export const actions: Actions = {
	create: async ({ request, params, locals }) => {
		const { user } = requireAuth(locals);
		const form = await superValidate(request, valibot(createCommentSchema));
		if (!form.valid) return fail(400, { form });

		const postId = await getPostIdBySlug(params.slug);
		if (!postId) error(404, 'Post not found');

		try {
			const result = await createComment({
				postId,
				authorId: user.id,
				locale: form.data.locale,
				body: form.data.body,
				clientNonce: form.data.clientNonce,
			});
			return { form, commentId: result.id, idempotentReplay: result.idempotentReplay };
		} catch (err) {
			if (err instanceof CommentOnUnpublishedError) {
				return fail(403, { form, code: err.code });
			}
			throw err;
		}
	},

	edit: async ({ request, locals }) => {
		const { user } = requireAuth(locals);
		const form = await superValidate(request, valibot(editFormSchema));
		if (!form.valid) return fail(400, { form });

		try {
			await editOwnComment({ commentId: form.data.commentId, authorId: user.id, body: form.data.body });
			return { form };
		} catch (err) {
			if (err instanceof CommentNotFoundError) return fail(404, { form, code: err.code });
			if (err instanceof CommentNotOwnedError) return fail(403, { form, code: err.code });
			if (err instanceof CommentEditWindowExpiredError) return fail(409, { form, code: err.code });
			if (err instanceof CommentHiddenError) return fail(409, { form, code: err.code });
			throw err;
		}
	},

	delete: async ({ request, locals }) => {
		const { user } = requireAuth(locals);
		const form = await superValidate(request, valibot(deleteFormSchema));
		if (!form.valid) return fail(400, { form });

		try {
			await softDeleteOwnComment({ commentId: form.data.commentId, authorId: user.id });
			return { deleted: true };
		} catch (err) {
			if (err instanceof CommentNotFoundError) return fail(404, { code: err.code });
			if (err instanceof CommentNotOwnedError) return fail(403, { code: err.code });
			throw err;
		}
	},
};
