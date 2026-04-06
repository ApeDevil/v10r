/**
 * Desk tool factory — assembles tools based on granted scopes.
 * Auth is captured via userId closure — no per-tool re-auth.
 */
import { createReadTools } from './desk-read';
import { createWriteTools } from './desk-write';
import { createCreateTools, createDeleteTools } from './desk-create';
import type { DeskToolScope } from './_types';

export type { DeskEffect, DeskToolScope } from './_types';

export function createDeskTools(userId: string, scopes: DeskToolScope[]) {
	const tools: Record<string, unknown> = {};

	// Read tools available when any desk scope is granted
	if (scopes.length > 0) {
		Object.assign(tools, createReadTools(userId));
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
