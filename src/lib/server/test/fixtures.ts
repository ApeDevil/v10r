import type { InferInsertModel } from 'drizzle-orm';
import type { conversation } from '$lib/server/db/schema/ai/conversation';
import type { user } from '$lib/server/db/schema/auth/_better-auth';
import type { notificationDeliveries } from '$lib/server/db/schema/notifications/deliveries';
import type { notifications } from '$lib/server/db/schema/notifications/notifications';

type UserInsert = InferInsertModel<typeof user>;
type NotificationInsert = InferInsertModel<typeof notifications>;
type ConversationInsert = InferInsertModel<typeof conversation>;
type DeliveryInsert = InferInsertModel<typeof notificationDeliveries>;

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
		title: 'Test notification',
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
