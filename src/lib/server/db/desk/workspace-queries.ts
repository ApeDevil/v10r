import { eq } from 'drizzle-orm';
import { db } from '../index';
import { deskWorkspace, deskWorkspaceActive } from '../schema/desk';

export interface DeskWorkspaceRow {
	id: string;
	userId: string;
	name: string;
	layout: typeof deskWorkspace.$inferSelect.layout;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

/** List all workspaces for a user, ordered by sortOrder. */
export async function listWorkspaces(userId: string): Promise<DeskWorkspaceRow[]> {
	return db
		.select()
		.from(deskWorkspace)
		.where(eq(deskWorkspace.userId, userId))
		.orderBy(deskWorkspace.sortOrder);
}

/** Get the active workspace ID for a user. Returns null if none set. */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
	const [row] = await db
		.select({ workspaceId: deskWorkspaceActive.workspaceId })
		.from(deskWorkspaceActive)
		.where(eq(deskWorkspaceActive.userId, userId))
		.limit(1);
	return row?.workspaceId ?? null;
}
