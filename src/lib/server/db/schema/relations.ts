/**
 * DRIZZLE RELATIONS — Centralized relation definitions for db.query API.
 * Single file to avoid circular imports (community consensus, Discussion #2577).
 * v1 API only — no .through(), junction tables traversed explicitly.
 */
import { relations } from 'drizzle-orm';

import {
	account,
	auditLog,
	chunk,
	collection,
	collectionDocument,
	// ai
	conversation,
	conversationStep,
	toolCall,
	document,
	// rag
	embeddingModel,
	message,
	notificationDeliveries,
	notificationSettings,
	// notifications
	notifications,
	session,
	// desk
	folder,
	file,
	markdown,
	spreadsheet,
	deskTheme,
	deskThemePreset,
	telegramVerificationTokens,
	// showcase
	typeSpecimen,
	typeSpecimenHistory,
	// auth
	user,
	userDiscordAccounts,
	// app
	customPalettes,
	userPreferences,
	userTelegramAccounts,
	// blog
	post,
	revision,
	publishedRevision,
	tag,
	postTag,
	asset,
	postAsset,
	domain,
} from './index';

// ── Auth ─────────────────────────────────────────────────────────────

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ── AI ───────────────────────────────────────────────────────────────

export const conversationRelations = relations(conversation, ({ one, many }) => ({
	user: one(user, { fields: [conversation.userId], references: [user.id] }),
	messages: many(message),
	steps: many(conversationStep),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
	conversation: one(conversation, {
		fields: [message.conversationId],
		references: [conversation.id],
	}),
	toolCalls: many(toolCall),
}));

export const toolCallRelations = relations(toolCall, ({ one }) => ({
	message: one(message, {
		fields: [toolCall.messageId],
		references: [message.id],
	}),
}));

export const conversationStepRelations = relations(conversationStep, ({ one }) => ({
	conversation: one(conversation, {
		fields: [conversationStep.conversationId],
		references: [conversation.id],
	}),
	message: one(message, {
		fields: [conversationStep.messageId],
		references: [message.id],
	}),
}));

// ── RAG ──────────────────────────────────────────────────────────────

export const embeddingModelRelations = relations(embeddingModel, ({ many }) => ({
	chunks: many(chunk),
}));

export const documentRelations = relations(document, ({ one, many }) => ({
	user: one(user, { fields: [document.userId], references: [user.id] }),
	chunks: many(chunk),
	collectionDocuments: many(collectionDocument),
}));

export const chunkRelations = relations(chunk, ({ one, many }) => ({
	document: one(document, { fields: [chunk.documentId], references: [document.id] }),
	embeddingModel: one(embeddingModel, {
		fields: [chunk.embeddingModelId],
		references: [embeddingModel.id],
	}),
	parent: one(chunk, {
		fields: [chunk.parentId],
		references: [chunk.id],
		relationName: 'chunk_parent',
	}),
	children: many(chunk, { relationName: 'chunk_parent' }),
}));

export const collectionRelations = relations(collection, ({ one, many }) => ({
	user: one(user, { fields: [collection.userId], references: [user.id] }),
	collectionDocuments: many(collectionDocument),
}));

export const collectionDocumentRelations = relations(collectionDocument, ({ one }) => ({
	collection: one(collection, {
		fields: [collectionDocument.collectionId],
		references: [collection.id],
	}),
	document: one(document, {
		fields: [collectionDocument.documentId],
		references: [document.id],
	}),
}));

// ── Notifications ────────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
	user: one(user, {
		fields: [notifications.userId],
		references: [user.id],
		relationName: 'notification_recipient',
	}),
	actor: one(user, {
		fields: [notifications.actorId],
		references: [user.id],
		relationName: 'notification_actor',
	}),
	deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
	notification: one(notifications, {
		fields: [notificationDeliveries.notificationId],
		references: [notifications.id],
	}),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
	user: one(user, { fields: [notificationSettings.userId], references: [user.id] }),
}));

export const userTelegramAccountsRelations = relations(userTelegramAccounts, ({ one }) => ({
	user: one(user, { fields: [userTelegramAccounts.userId], references: [user.id] }),
}));

export const telegramVerificationTokensRelations = relations(telegramVerificationTokens, ({ one }) => ({
	user: one(user, {
		fields: [telegramVerificationTokens.userId],
		references: [user.id],
	}),
}));

export const userDiscordAccountsRelations = relations(userDiscordAccounts, ({ one }) => ({
	user: one(user, { fields: [userDiscordAccounts.userId], references: [user.id] }),
}));

// ── Showcase ─────────────────────────────────────────────────────────

export const typeSpecimenRelations = relations(typeSpecimen, ({ many }) => ({
	history: many(typeSpecimenHistory),
	auditEntries: many(auditLog),
}));

export const typeSpecimenHistoryRelations = relations(typeSpecimenHistory, ({ one }) => ({
	specimen: one(typeSpecimen, {
		fields: [typeSpecimenHistory.specimenId],
		references: [typeSpecimen.id],
	}),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	specimen: one(typeSpecimen, {
		fields: [auditLog.specimenId],
		references: [typeSpecimen.id],
	}),
}));

// ── Desk ────────────────────────────────────────────────────────────

export const folderRelations = relations(folder, ({ one, many }) => ({
	user: one(user, { fields: [folder.userId], references: [user.id] }),
	parent: one(folder, { fields: [folder.parentId], references: [folder.id], relationName: 'folderTree' }),
	children: many(folder, { relationName: 'folderTree' }),
	files: many(file),
}));

export const fileRelations = relations(file, ({ one }) => ({
	user: one(user, { fields: [file.userId], references: [user.id] }),
	folder: one(folder, { fields: [file.folderId], references: [folder.id] }),
	spreadsheet: one(spreadsheet),
	markdown: one(markdown),
}));

export const spreadsheetRelations = relations(spreadsheet, ({ one }) => ({
	user: one(user, { fields: [spreadsheet.userId], references: [user.id] }),
	file: one(file, { fields: [spreadsheet.fileId], references: [file.id] }),
}));

export const markdownRelations = relations(markdown, ({ one }) => ({
	user: one(user, { fields: [markdown.userId], references: [user.id] }),
	file: one(file, { fields: [markdown.fileId], references: [file.id] }),
}));

export const deskThemeRelations = relations(deskTheme, ({ one }) => ({
	user: one(user, { fields: [deskTheme.userId], references: [user.id] }),
}));

export const deskThemePresetRelations = relations(deskThemePreset, ({ one }) => ({
	user: one(user, { fields: [deskThemePreset.userId], references: [user.id] }),
}));

// ── App ─────────────────────────────────────────────────────────────

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
	user: one(user, { fields: [userPreferences.userId], references: [user.id] }),
}));

export const customPalettesRelations = relations(customPalettes, ({ one }) => ({
	creator: one(user, { fields: [customPalettes.createdBy], references: [user.id] }),
}));

// ── Blog ─────────────────────────────────────────────────────────────

export const postRelations = relations(post, ({ one, many }) => ({
	author: one(user, { fields: [post.authorId], references: [user.id] }),
	coverImage: one(asset, { fields: [post.coverImageId], references: [asset.id] }),
	domain: one(domain, { fields: [post.domainId], references: [domain.id] }),
	revisions: many(revision),
	publishedRevisions: many(publishedRevision),
	postTags: many(postTag),
	postAssets: many(postAsset),
}));

export const domainRelations = relations(domain, ({ many }) => ({
	posts: many(post),
}));

export const revisionRelations = relations(revision, ({ one }) => ({
	post: one(post, { fields: [revision.postId], references: [post.id] }),
	author: one(user, { fields: [revision.authorId], references: [user.id] }),
}));

export const publishedRevisionRelations = relations(publishedRevision, ({ one }) => ({
	post: one(post, { fields: [publishedRevision.postId], references: [post.id] }),
	revision: one(revision, { fields: [publishedRevision.revisionId], references: [revision.id] }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
	postTags: many(postTag),
}));

export const postTagRelations = relations(postTag, ({ one }) => ({
	post: one(post, { fields: [postTag.postId], references: [post.id] }),
	tag: one(tag, { fields: [postTag.tagId], references: [tag.id] }),
}));

export const blogAssetRelations = relations(asset, ({ one, many }) => ({
	uploader: one(user, { fields: [asset.uploaderId], references: [user.id] }),
	postAssets: many(postAsset),
}));

export const postAssetRelations = relations(postAsset, ({ one }) => ({
	post: one(post, { fields: [postAsset.postId], references: [post.id] }),
	asset: one(asset, { fields: [postAsset.assetId], references: [asset.id] }),
}));

// ── User hub (the big one) ──────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
	// auth
	sessions: many(session),
	accounts: many(account),
	// ai
	conversations: many(conversation),
	toolCalls: many(toolCall),
	// rag
	documents: many(document),
	collections: many(collection),
	// notifications
	notifications: many(notifications, { relationName: 'notification_recipient' }),
	actedNotifications: many(notifications, { relationName: 'notification_actor' }),
	notificationSettings: one(notificationSettings),
	telegramAccount: one(userTelegramAccounts),
	discordAccount: one(userDiscordAccounts),
	telegramVerificationTokens: many(telegramVerificationTokens),
	// app
	preferences: one(userPreferences),
	customPalettes: many(customPalettes),
	// desk
	files: many(file),
	spreadsheets: many(spreadsheet),
	markdowns: many(markdown),
	deskTheme: one(deskTheme),
	deskThemePresets: many(deskThemePreset),
	// blog
	posts: many(post),
	revisions: many(revision),
	blogAssets: many(asset),
}));
