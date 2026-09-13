/**
 * The deskbot profile — the workspace operator.
 *
 * Agentic, mutating, approval-gated: it works on the user's desk files with the tools the
 * user's consent scopes grant, and every change to an existing file is a proposal the user
 * decides on. Its capabilities, in prompt order: the tool loop's end, the desk awareness,
 * the five scoped capabilities, the plan/approval rule, the compaction escape hatch.
 */

import { compaction } from '../capabilities/compaction';
import { completion } from '../capabilities/completion';
import { deskAsk } from '../capabilities/desk-ask';
import { deskAwareness } from '../capabilities/desk-awareness';
import { deskCreate } from '../capabilities/desk-create';
import { deskDelete } from '../capabilities/desk-delete';
import { deskEdit } from '../capabilities/desk-edit';
import { deskFiles } from '../capabilities/desk-files';
import { deskPlan, hasMutatingScope } from '../capabilities/desk-plan';
import { DESK_MUTATE_MAX_STEPS, DESK_READ_MAX_STEPS } from '../config';
import type { AssistantProfile } from './profile';
import { SHARED_RULES } from './shared-rules';

export const DESKBOT_PROFILE: AssistantProfile = {
	surface: 'deskbot',
	identity: {
		name: 'the Velociraptor workspace assistant',
		role: "You are the Velociraptor workspace assistant — concise, tool-using, workspace-aware.\nYou can see the user's open panels and work on their DESK FILES: spreadsheets and markdown documents. You can list, search and read them, create new ones, and propose cell updates, document edits, renames and deletions for the user to approve. The file tree also lists blog posts and image assets for orientation — no desk tool reads or edits those; say so rather than trying.",
		rules: [
			'Be concise. Keep answers under 300 words unless the user asks for detail.',
			'Summarize data insights concisely. Use markdown tables for tabular results.',
			...SHARED_RULES,
		],
	},
	capabilities: [
		completion,
		deskAwareness(() => DESKBOT_PROFILE),
		deskFiles,
		deskEdit,
		deskCreate,
		deskDelete,
		deskAsk,
		deskPlan,
		compaction,
	],
	wantsTools: (turn) => turn.scopes.length > 0,
	// One extra hop for the plan-propose → execute step when a mutating scope is granted.
	stepBudget: (turn) => (hasMutatingScope(turn.scopes) ? DESK_MUTATE_MAX_STEPS : DESK_READ_MAX_STEPS),
	awareness: (turn) => ({
		locale: turn.locale,
		authCeiling: turn.authCeiling,
		scopes: turn.scopes,
		workspace: turn.activeWorkspace ?? null,
		layout: turn.deskLayout,
		panels: turn.panelContext?.map((pc) => ({
			panelType: pc.panelType,
			label: pc.label,
			fileId: pc.fileId,
			fileType: pc.fileType,
			chars: pc.content.length,
			truncated: pc.truncated,
			dirty: pc.dirty,
		})),
	}),
};
