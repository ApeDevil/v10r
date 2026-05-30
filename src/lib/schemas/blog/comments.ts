/**
 * Shared Valibot schemas for blog comments — safe to import from client code.
 * The server-side wrapper at $lib/server/blog/comments re-exports these.
 */
import * as v from 'valibot';
import { locales } from '$lib/i18n';

export const localeSchema = v.picklist(locales as readonly string[]);

export const commentBodySchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4000));

export const clientNonceSchema = v.pipe(v.string(), v.regex(/^[0-9a-f-]{8,}$/, 'Invalid clientNonce'), v.maxLength(64));

export const createCommentSchema = v.object({
	locale: localeSchema,
	body: commentBodySchema,
	clientNonce: clientNonceSchema,
});

export type CreateCommentInput = v.InferOutput<typeof createCommentSchema>;

export const editCommentSchema = v.object({
	body: commentBodySchema,
});

export type EditCommentInput = v.InferOutput<typeof editCommentSchema>;

export const moderateCommentSchema = v.object({
	reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
});

export const listCommentsQuerySchema = v.object({
	locale: localeSchema,
	cursor: v.optional(v.string()),
	limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(50))),
});

export type ListCommentsQuery = v.InferOutput<typeof listCommentsQuerySchema>;
