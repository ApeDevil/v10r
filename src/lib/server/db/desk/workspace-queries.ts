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
	try {
		return await db
			.select()
			.from(deskWorkspace)
			.where(eq(deskWorkspace.userId, userId))
			.orderBy(deskWorkspace.sortOrder);
	} catch {
		// Table may not exist yet (pre-migration)
		return [];
	}
}

/** Get the active workspace ID for a user. Returns null if none set. */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
	try {
		const [row] = await db
			.select({ workspaceId: deskWorkspaceActive.workspaceId })
			.from(deskWorkspaceActive)
			.where(eq(deskWorkspaceActive.userId, userId))
			.limit(1);
		return row?.workspaceId ?? null;
	} catch {
		return null;
	}
}
