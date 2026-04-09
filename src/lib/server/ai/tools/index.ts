/**
 * Desk tool factory — assembles tools based on granted scopes.
 * Auth is captured via userId closure — no per-tool re-auth.
 */

import type { ToolSet } from 'ai';
import type { DeskToolScope } from './_types';
import { createCreateTools, createDeleteTools } from './desk-create';
import { createReadTools } from './desk-read';
import { createWriteTools } from './desk-write';

export type { DeskEffect, DeskToolScope } from './_types';

export function createDeskTools(userId: string, scopes: DeskToolScope[]): ToolSet {
	const tools: ToolSet = {} as ToolSet;

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
