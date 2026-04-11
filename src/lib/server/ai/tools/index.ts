/**
 * Desk tool factory — assembles tools based on granted scopes.
 * Auth is captured via userId closure — no per-tool re-auth.
 */

import type { ToolSet } from 'ai';
import type { DeskLayoutEntry, DeskToolScope } from './_types';
import { createCreateTools, createDeleteTools } from './desk-create';
import { createReadTools } from './desk-read';
import { createWriteTools } from './desk-write';

export type { DeskEffect, DeskLayoutEntry, DeskToolScope } from './_types';

export function createDeskTools(userId: string, scopes: DeskToolScope[], deskLayout?: DeskLayoutEntry[]): ToolSet {
	const tools: ToolSet = {} as ToolSet;

	// Read tools available when any desk scope is granted
	if (scopes.length > 0) {
		Object.assign(tools, createReadTools(userId, deskLayout));
	}

	if (scopes.includes('desk:write')) {
		Object.assign(tools, createWriteTools(userId));
	}

	if (scopes.includes('desk:create')) {
		Object.assign(tools, createCreateTools(userId));
	}

	if (scopes.includes('desk:delete')) {
		Object.assign(tools, createDeleteTools(userId));
	}

	return tools;
}

/** Determine step limit based on tool scopes. Read-only = 3, mutation = 5. */
export function stepsForScopes(scopes: DeskToolScope[]): number {
	return scopes.some((s) => s !== 'desk:read') ? 5 : 3;
}
