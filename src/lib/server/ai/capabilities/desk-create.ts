/**
 * desk-create — new spreadsheets and documents. Granted by `desk:create`. A create is
 * reversible (soft delete), so it is the one desk mutation that runs in-loop, unapproved.
 */
import type { AssistantCapability } from '../profile/profile';
import { createCreateTools } from '../tools/desk-create';
import { deskScopeActivation } from './desk-scope';

export const deskCreate: AssistantCapability = {
	id: 'desk-create',
	when: 'the desk:create scope is granted',
	scope: { id: 'desk:create', description: 'create: Create new spreadsheets and documents' },
	guidance: 'Creating a brand-new file DOES take effect immediately — it is not queued for approval.',
	activates: deskScopeActivation('desk:create'),
	tools: (turn) => createCreateTools(turn.userId),
};
