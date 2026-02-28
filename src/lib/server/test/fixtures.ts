import type { InferInsertModel } from 'drizzle-orm';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { notifications } from '$lib/server/db/schema/notifications/notifications';

type UserInsert = InferInsertModel<typeof user>;
type NotificationInsert = InferInsertModel<typeof notifications>;

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
