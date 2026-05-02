import type { InferInsertModel } from 'drizzle-orm';
import type { conversation } from '$lib/server/db/schema/ai/conversation';
import type { user } from '$lib/server/db/schema/auth/_better-auth';
import type { file } from '$lib/server/db/schema/desk/file';
import type { folder } from '$lib/server/db/schema/desk/folder';
import type { markdown } from '$lib/server/db/schema/desk/markdown';
import type { spreadsheet } from '$lib/server/db/schema/desk/spreadsheet';
import type { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import type { notifications } from '$lib/server/db/schema/notifications/notifications';

type UserInsert = InferInsertModel<typeof user>;
type NotificationInsert = InferInsertModel<typeof notifications>;
type ConversationInsert = InferInsertModel<typeof conversation>;
type DeliveryInsert = InferInsertModel<typeof notificationDeliveries>;
type FileInsert = InferInsertModel<typeof file>;
type FolderInsert = InferInsertModel<typeof folder>;
type SpreadsheetInsert = InferInsertModel<typeof spreadsheet>;
type MarkdownInsert = InferInsertModel<typeof markdown>;

export function makeUser(overrides?: Partial<UserInsert>): UserInsert {
	const id = overrides?.id ?? crypto.randomUUID();
	return {
		id,
		name: `Test User ${id.slice(0, 6)}`,
		email: `${id.slice(0, 8)}@test.local`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function makeNotification(overrides?: Partial<NotificationInsert>): NotificationInsert {
	return {
		id: crypto.randomUUID(),
		userId: 'must-be-set',
		type: 'system',
		messageKey: 'notif_system',
		messageParams: {},
		isRead: false,
		createdAt: new Date(),
		...overrides,
	};
}

export function makeConversation(overrides?: Partial<ConversationInsert>): ConversationInsert {
	return {
		id: crypto.randomUUID(),
		userId: 'must-be-set',
		title: 'Test conversation',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function makeDelivery(overrides?: Partial<DeliveryInsert>): DeliveryInsert {
	return {
		id: crypto.randomUUID(),
		notificationId: 'must-be-set',
		channel: 'email',
		status: 'pending',
		attempts: 0,
		createdAt: new Date(),
		...overrides,
	};
}

export function makeFile(overrides?: Partial<FileInsert>): FileInsert {
	return {
		id: `fil_${crypto.randomUUID().slice(0, 8)}`,
		userId: 'must-be-set',
		type: 'spreadsheet',
		name: 'Test File',
		folderId: null,
		aiContext: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function makeFolder(overrides?: Partial<FolderInsert>): FolderInsert {
	return {
		id: `fol_${crypto.randomUUID().slice(0, 8)}`,
		userId: 'must-be-set',
		parentId: null,
		name: 'Test Folder',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function makeSpreadsheet(overrides?: Partial<SpreadsheetInsert>): SpreadsheetInsert {
	return {
		id: `spr_${crypto.randomUUID().slice(0, 8)}`,
		fileId: 'must-be-set',
		userId: 'must-be-set',
		name: 'Test Spreadsheet',
		cells: {},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

export function makeMarkdown(overrides?: Partial<MarkdownInsert>): MarkdownInsert {
	return {
		id: `md_${crypto.randomUUID().slice(0, 8)}`,
		fileId: 'must-be-set',
		userId: 'must-be-set',
		content: '',
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}
