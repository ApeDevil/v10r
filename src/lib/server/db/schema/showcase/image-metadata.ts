/**
 * IMAGE METADATA — Image Metadata Reader showcase.
 *
 * A vision AI analyses an uploaded image and proposes metadata; the human reviews
 * (manual form + approval dialog) before it persists. Unlike the ephemeral showcase
 * demo tables, this carries real per-user data with a GDPR surface (opt-in GPS), so
 * it gets its own `image` Postgres namespace rather than sharing `showcase`.
 *
 * Three records + a tag junction:
 *   image.asset        — the R2-backed (EXIF-stripped) image the user uploaded
 *   image.metadata     — the 1:1 editable metadata record + approval state + provenance
 *   image.ai_proposal  — append-only snapshot of each AI run (raw output + telemetry)
 *   image.tag / image.metadata_tag — N:M keywords
 *
 * Mirrors the agent_proposal approval pattern (status enum, approvedBy/approvedAt) but
 * does NOT reuse ai.agent_proposal: that table's conversationId/messageId are NOT-NULL
 * FKs and its payload is ProposedToolCall[] — an image proposal is neither.
 */

import { sql } from 'drizzle-orm';
import {
	check,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
	ConfidenceTier,
	FieldProvenance,
	ImageAnalysis,
	MetadataFieldKey,
} from '$lib/schemas/showcase/image-metadata';
import { user } from '../auth/_better-auth';

export const imageSchema = pgSchema('image');

/** Approval lifecycle. Whole-form atomic: one status drives the whole metadata record. */
export const imageMetadataStatusEnum = imageSchema.enum('image_metadata_status', [
	'draft',
	'proposed',
	'approved',
	'rejected',
]);

/** Keep in sync with IMAGE_CATEGORIES in $lib/schemas/showcase/image-metadata. */
export const imageCategoryEnum = imageSchema.enum('image_category', [
	'photo',
	'illustration',
	'screenshot',
	'diagram',
	'document',
	'other',
]);

// image.asset — the uploaded (stripped) image in R2

export const imageAsset = imageSchema.table(
	'asset',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Owner. Cascade: a user's images are erasable (opposite of blog.asset's SET NULL). */
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** R2 key of the EXIF-stripped derivative actually served (never the original). */
		storageKey: text('storage_key').notNull(),
		mimeType: text('mime_type').notNull(),
		fileSize: integer('file_size').notNull(),
		width: integer('width'),
		height: integer('height'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('image_asset_storage_key_idx').on(table.storageKey),
		index('image_asset_user_idx').on(table.userId),
		check('image_asset_size_positive', sql`${table.fileSize} > 0`),
	],
);

// ── image.metadata — editable record + approval state + provenance ──

export const imageMetadata = imageSchema.table(
	'metadata',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** 1:1 with the asset. */
		imageId: text('image_id')
			.notNull()
			.references(() => imageAsset.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		caption: text('caption').notNull().default(''),
		altText: text('alt_text').notNull(),
		category: imageCategoryEnum('category').notNull(),
		status: imageMetadataStatusEnum('status').notNull().default('draft'),
		/** Opt-in sensitive field — only set when the human approves location capture. */
		gpsLat: doublePrecision('gps_lat'),
		gpsLng: doublePrecision('gps_lng'),
		/** Per-field provenance (empty | ai-draft | human). Advisory display + audit; never gates save. */
		fieldProvenance: jsonb('field_provenance').$type<FieldProvenance>().notNull(),
		approvedBy: text('approved_by').references(() => user.id, { onDelete: 'set null' }),
		approvedAt: timestamp('approved_at', { withTimezone: true }),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex('image_metadata_image_idx').on(table.imageId),
		index('image_metadata_status_idx').on(table.status).where(sql`deleted_at IS NULL`),
		// GPS is both-or-neither (a half-coordinate is a corrupt location) and in-range.
		// Makes the invalid states unrepresentable at rest, not just handler-enforced.
		check('image_metadata_gps_pair', sql`(${table.gpsLat} IS NULL) = (${table.gpsLng} IS NULL)`),
		check(
			'image_metadata_gps_range',
			sql`(${table.gpsLat} IS NULL OR (${table.gpsLat} BETWEEN -90 AND 90))
			    AND (${table.gpsLng} IS NULL OR (${table.gpsLng} BETWEEN -180 AND 180))`,
		),
	],
);

// image.ai_proposal — append-only run snapshot + telemetry

export const imageAiProposal = imageSchema.table(
	'ai_proposal',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		imageId: text('image_id')
			.notNull()
			.references(() => imageAsset.id, { onDelete: 'cascade' }),
		providerId: text('provider_id').notNull(),
		modelId: text('model_id').notNull(),
		inputTokens: integer('input_tokens'),
		outputTokens: integer('output_tokens'),
		/** Gemini "thinking" tokens (thoughtsTokenCount). NULL = provider didn't report; billed at the output rate. */
		reasoningTokens: integer('reasoning_tokens'),
		durationMs: integer('duration_ms'),
		/** The model's raw structured output (ImageAnalysis), verbatim. */
		rawProposal: jsonb('raw_proposal').$type<ImageAnalysis>().notNull(),
		/** Per-field confidence buckets the model self-reported. */
		confidence: jsonb('confidence').$type<Record<MetadataFieldKey, ConfidenceTier>>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index('image_ai_proposal_image_idx').on(table.imageId, table.createdAt.desc()),
		// Admin telemetry scans by time window then groups by model
		// (WHERE created_at >= since GROUP BY model_id) — a RANGE predicate on
		// created_at, so it must lead for an index range scan; model_id rides as
		// the grouping companion. The image_idx above serves per-image re-run lookups.
		index('image_ai_proposal_created_model_idx').on(table.createdAt.desc(), table.modelId),
	],
);

// image.tag + image.metadata_tag — N:M keywords

export const imageTag = imageSchema.table(
	'tag',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Normalised (lowercased, trimmed) keyword. */
		label: text('label').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex('image_tag_label_idx').on(table.label)],
);

export const imageMetadataTag = imageSchema.table(
	'metadata_tag',
	{
		metadataId: text('metadata_id')
			.notNull()
			.references(() => imageMetadata.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => imageTag.id, { onDelete: 'cascade' }),
	},
	(table) => [
		primaryKey({ columns: [table.metadataId, table.tagId] }),
		index('image_metadata_tag_tag_idx').on(table.tagId),
	],
);
