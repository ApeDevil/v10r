import { and, eq } from 'drizzle-orm';
import { createId } from '../id';
import { db } from '../index';
import { deskWorkspace, deskWorkspaceActive } from '../schema/desk';
import type { WorkspaceLayoutJson } from '../schema/desk/workspace';

const MAX_WORKSPACES = 9;

/** Create a workspace and auto-activate it. Returns null if at limit. */
export async function createWorkspace(
	userId: string,
	data: { name: string; layout: WorkspaceLayoutJson; sortOrder?: number },
) {
	return db.transaction(async (tx) => {
		// Check limit (inside transaction to prevent races)
		const existing = await tx
			.select({ id: deskWorkspace.id })
			.from(deskWorkspace)
			.where(eq(deskWorkspace.userId, userId));

		if (existing.length >= MAX_WORKSPACES) return null;

		const id = createId.workspace();
		const sortOrder = data.sortOrder ?? existing.length;

		const [workspace] = await tx
			.insert(deskWorkspace)
			.values({ id, userId, name: data.name, layout: data.layout, sortOrder })
			.returning();

		// Auto-activate via upsert
		await tx
			.insert(deskWorkspaceActive)
			.values({ userId, workspaceId: id, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: deskWorkspaceActive.userId,
				set: { workspaceId: id, updatedAt: new Date() },
			});

		return workspace;
	});
}

/** Partial update of a workspace (name, layout, sortOrder). */
export async function updateWorkspace(
	userId: string,
	workspaceId: string,
	data: { name?: string; layout?: WorkspaceLayoutJson; sortOrder?: number },
) {
	const set: Record<string, unknown> = { updatedAt: new Date() };
	if (data.name !== undefined) set.name = data.name;
	if (data.layout !== undefined) set.layout = data.layout;
	if (data.sortOrder !== undefined) set.sortOrder = data.sortOrder;

	const [row] = await db
		.update(deskWorkspace)
		.set(set)
		.where(and(eq(deskWorkspace.id, workspaceId), eq(deskWorkspace.userId, userId)))
		.returning();

	return row ?? null;
}

/** Delete a workspace. Returns the deleted row or null. */
export async function deleteWorkspace(userId: string, workspaceId: string) {
	const [row] = await db
		.delete(deskWorkspace)
		.where(and(eq(deskWorkspace.id, workspaceId), eq(deskWorkspace.userId, userId)))
		.returning({ id: deskWorkspace.id });

	return row ?? null;
}

/** Set the active workspace pointer (upsert). */
export async function setActiveWorkspace(userId: string, workspaceId: string) {
	await db
		.insert(deskWorkspaceActive)
		.values({ userId, workspaceId, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: deskWorkspaceActive.userId,
			set: { workspaceId, updatedAt: new Date() },
		});
}

/**
 * Atomic save-outgoing + activate-incoming.
 * Used on workspace switch and as sendBeacon target on tab close.
 */
export async function syncWorkspace(
	userId: string,
	data: { save?: { id: string; layout: WorkspaceLayoutJson }; activate: string },
) {
	return db.transaction(async (tx) => {
		let saved = false;

		if (data.save) {
			const [result] = await tx
				.update(deskWorkspace)
				.set({ layout: data.save.layout, updatedAt: new Date() })
				.where(and(eq(deskWorkspace.id, data.save.id), eq(deskWorkspace.userId, userId)))
				.returning({ id: deskWorkspace.id });
			saved = !!result;
		}

		// Activate target
		await tx
			.insert(deskWorkspaceActive)
			.values({ userId, workspaceId: data.activate, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: deskWorkspaceActive.userId,
				set: { workspaceId: data.activate, updatedAt: new Date() },
			});

		return { saved, activeId: data.activate };
	});
}

/** Swap sort orders of two workspaces atomically. */
export async function reorderWorkspaces(
	userId: string,
	orderedIds: string[],
) {
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(deskWorkspace)
				.set({ sortOrder: i, updatedAt: new Date() })
				.where(and(eq(deskWorkspace.id, orderedIds[i]), eq(deskWorkspace.userId, userId)));
		}
	});
}
