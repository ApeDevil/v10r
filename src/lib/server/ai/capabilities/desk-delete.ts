/**
 * desk-delete — deleting a desk file. Granted by `desk:delete`. Destructive: the tool
 * returns a `requiresApproval` sentinel; the approval rule is `desk-plan`'s guidance.
 */
import type { AssistantCapability } from '../profile/profile';
import { createDeleteTools } from '../tools/desk-create';
import { deskScopeActivation } from './desk-scope';

export const deskDelete: AssistantCapability = {
	id: 'desk-delete',
	when: 'the desk:delete scope is granted',
	scope: { id: 'desk:delete', description: 'delete: Delete files (queued for your approval before running)' },
	activates: deskScopeActivation('desk:delete'),
	tools: (turn) => createDeleteTools(turn.userId),
};
