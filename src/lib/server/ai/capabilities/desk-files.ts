/**
 * desk-files — reading the desk: list, tree, search, read, the open panels. Granted by
 * `desk:read`; the base every other desk capability assumes.
 */
import type { AssistantCapability } from '../profile/profile';
import { createReadTools } from '../tools/desk-read';
import { deskScopeActivation } from './desk-scope';

export const deskFiles: AssistantCapability = {
	id: 'desk-files',
	when: 'the desk:read scope is granted',
	scope: { id: 'desk:read', description: 'read: List files, read contents, search workspace' },
	guidance: `Use tools to discover information rather than guessing. When tool calls have no dependencies, call them in parallel.
When the user references "this spreadsheet" or "the document", check desk-context first. If not available, use desk_list_files to identify the target, then read its contents.
When a panel's context is at summary or title-only level, or marked truncated, use desk_read_file to get the full content if needed — a spreadsheet by range (e.g. A21:D40), a document by offset.
When citing spreadsheet data, reference cells by column letter and row number (e.g. A3, B12).`,
	activates: deskScopeActivation('desk:read'),
	tools: (turn) => createReadTools(turn.userId, turn.deskLayout),
};
