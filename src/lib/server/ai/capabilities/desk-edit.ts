/**
 * desk-edit — changing an existing desk file: cells, a markdown passage or the whole
 * document, the name. Granted by `desk:write`. Every tool here returns a `requiresApproval`
 * sentinel instead of mutating (the approval boundary, `desk-plan`); the mutation runs only
 * through the approve door.
 */
import type { AssistantCapability } from '../profile/profile';
import { createWriteTools } from '../tools/desk-write';
import { deskScopeActivation } from './desk-scope';

export const deskEdit: AssistantCapability = {
	id: 'desk-edit',
	when: 'the desk:write scope is granted',
	scope: {
		id: 'desk:write',
		description:
			'write: Update spreadsheet cells, edit or replace markdown content, rename files (queued for your approval before saving)',
	},
	guidance: `For a small change to a document, prefer desk_edit_markdown (exact passage → replacement) over rewriting the whole document.
Never rewrite a document from a partial read: read the whole document first, or edit only the passage you have seen.`,
	activates: deskScopeActivation('desk:write'),
	tools: (turn) => createWriteTools(turn.userId),
};
