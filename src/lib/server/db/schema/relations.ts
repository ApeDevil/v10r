/**
 * DRIZZLE RELATIONS — Centralized relation definitions for db.query API.
 * Single file to avoid circular imports (community consensus, Discussion #2577).
 * v1 API only — no .through(), junction tables traversed explicitly.
 */
import { relations } from 'drizzle-orm';

import {
	// auth
	user,
	session,
	account,
	// ai
	conversation,
	message,
	// rag
	embeddingModel,
	document,
	chunk,
	collection,
	collectionDocument,
	// notifications
	notifications,
	notificationDeliveries,
	notificationSettings,
	userTelegramAccounts,
	telegramVerificationTokens,
	userDiscordAccounts,
	// showcase
	typeSpecimen,
	typeSpecimenHistory,
	auditLog,
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
}));

export const messageRelations = relations(message, ({ one }) => ({
	conversation: one(conversation, {
		fields: [message.conversationId],
		references: [conversation.id],
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

export const telegramVerificationTokensRelations = relations(
	telegramVerificationTokens,
	({ one }) => ({
		user: one(user, {
			fields: [telegramVerificationTokens.userId],
			references: [user.id],
		}),
	}),
);

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

// ── User hub (the big one) ──────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
	// auth
	sessions: many(session),
	accounts: many(account),
	// ai
	conversations: many(conversation),
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
}));
