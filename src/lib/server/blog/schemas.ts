/** Valibot schemas for blog API endpoints. */
import * as v from 'valibot';
import { LocaleParam, Markdown, SlugParam } from '$lib/server/schemas/shared';

const MAX_MARKDOWN_SIZE = 500_000;

// ── Posts ───────────────────────────────────────────────────────────

export const CreatePostSchema = v.object({
	slug: SlugParam,
});

export const CreateRevisionSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(500)),
	summary: v.optional(v.pipe(v.string(), v.maxLength(2000))),
	markdown: v.pipe(Markdown, v.maxLength(MAX_MARKDOWN_SIZE)),
	locale: LocaleParam,
});

export const SetTagsSchema = v.object({
	tagIds: v.pipe(v.array(v.pipe(v.string(), v.startsWith('tag_'))), v.maxLength(50)),
});

export const SetDomainSchema = v.object({
	domainId: v.nullable(v.pipe(v.string(), v.startsWith('dom_'))),
});

export const PublishSchema = v.object({
	locale: LocaleParam,
});

// ── Assets ─────���────────────────────────────────────────────────────

export const RequestUploadSchema = v.object({
	fileName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	mimeType: v.pipe(v.string(), v.regex(/^[\w-]+\/[\w.+-]+$/)),
	fileSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50_000_000)),
});

export const ConfirmUploadSchema = v.object({
	key: v.pipe(v.string(), v.regex(/^blog\/[0-9a-f-]{36}\.\w{1,10}$/)),
	fileName: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
	mimeType: v.pipe(v.string(), v.regex(/^[\w-]+\/[\w.+-]+$/)),
	fileSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50_000_000)),
	width: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	height: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	altText: v.optional(v.pipe(v.string(), v.maxLength(1000))),
});

export const PatchAssetSchema = v.object({
	altText: v.optional(v.pipe(v.string(), v.maxLength(1000))),
	width: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	height: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	fileName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	/** Null moves the asset to the assets root (virtual:assets on the client). */
	folderId: v.optional(v.nullable(v.pipe(v.string(), v.startsWith('afd_')))),
});

// ── Preview ─────────────────────────────────────────────────────────

export const PreviewSchema = v.object({
	markdown: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_MARKDOWN_SIZE)),
});
