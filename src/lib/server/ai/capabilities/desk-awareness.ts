/**
 * desk-awareness — what the deskbot is told about the user's live desk: the consent scopes
 * as `<permissions>`, the workspace, the open panels with their content as
 * `<desk-context>`, the panel layout as `<desk-layout>`.
 *
 * Every block here is per-request — the variable tail behind the cache-stable prefix.
 * Panel content is the one field a hostile desk file controls, so it is escaped like every
 * sibling value: unescaped, a file containing `</panel></desk-context>` closes the block
 * early and the rest of that file reads as prompt rather than data — to a model holding
 * desk:write / desk:delete tools.
 */
import { CONTEXT_ENTRY_MAX_CHARS } from '$lib/types/desk-context-limits';
import { escapeXmlAttr, escapeXmlText } from '$lib/utils/xml';
import type { AssistantCapability, AssistantProfile, BlockDraft, TurnInput } from '../profile/profile';
import type { DeskToolScope } from '../tools/_types';

/** `<permissions>`: every scoped capability of the profile, enabled or disabled for this turn. */
export function permissionsBlock(profile: AssistantProfile, scopes: readonly DeskToolScope[]): string {
	const lines = profile.capabilities
		.filter((c) => c.scope)
		.map(
			(c) => `- ${c.scope?.description} [${scopes.includes(c.scope?.id as DeskToolScope) ? 'enabled' : 'disabled'}]`,
		);
	return `<permissions>\n${lines.join('\n')}\n</permissions>`;
}

/** `<desk-context>`: the open panels' content, with the identity a proposed edit names. */
export function deskContextBlock(panelContext: NonNullable<TurnInput['panelContext']>): string {
	// The entry cap is the client serializer's and the route schema's (`desk-context-limits`);
	// the slice here can no longer fire on a valid request and exists so an oversized entry
	// could never reach the prompt through any other caller.
	const panels = panelContext
		.map((pc) => ({
			...pc,
			content: pc.content.replace(/(?:sk-|ghp_|AKIA|Bearer\s)\S+/gi, '[REDACTED]').slice(0, CONTEXT_ENTRY_MAX_CHARS),
		}))
		.map((pc) => {
			const statusAttr = pc.status ? ` status="${escapeXmlAttr(pc.status)}"` : '';
			const levelAttr = pc.contentLevel ? ` level="${escapeXmlAttr(pc.contentLevel)}"` : '';
			// The identity attributes are what a proposed edit names: the file, and the version
			// the model read — `truncated` says the text is not the whole file, `dirty` that the
			// panel holds edits the server has not saved.
			const fileAttr = pc.fileId ? ` file_id="${escapeXmlAttr(pc.fileId)}"` : '';
			const kindAttr = pc.fileType ? ` file_type="${escapeXmlAttr(pc.fileType)}"` : '';
			const versionAttr = pc.version !== undefined ? ` version="${pc.version}"` : '';
			const truncatedAttr = pc.truncated ? ' truncated="true"' : '';
			const dirtyAttr = pc.dirty ? ' unsaved_edits="true"' : '';
			return `<panel type="${escapeXmlAttr(pc.panelType)}" label="${escapeXmlAttr(pc.label)}"${statusAttr}${levelAttr}${fileAttr}${kindAttr}${versionAttr}${truncatedAttr}${dirtyAttr}>\n${escapeXmlText(pc.content)}\n</panel>`;
		})
		.join('\n');
	return `<desk-context>\n${panels}\n</desk-context>`;
}

/** `<desk-layout>`: `{ id, type, title }` per panel — no positions, sizes or styles. */
export function deskLayoutBlock(deskLayout: NonNullable<TurnInput['deskLayout']>): string {
	const lines = deskLayout
		.map((p) => {
			const idPart = p.fileId ? ` [${escapeXmlAttr(p.fileId)}]` : '';
			const typePart = escapeXmlAttr(p.fileType ?? 'panel');
			return `- ${escapeXmlAttr(p.label)} (${typePart})${idPart}`;
		})
		.join('\n');
	return `<desk-layout>\n${lines}\n</desk-layout>`;
}

/**
 * The awareness blocks need the profile's scoped capabilities for `<permissions>`, so the
 * capability is built per profile rather than declared once.
 */
export function deskAwareness(profile: () => AssistantProfile): AssistantCapability {
	return {
		id: 'desk-awareness',
		when: 'any desk scope is granted — without one the desk blocks are the biggest token win to skip',
		guidance: `Panel context includes a status (focused/active/background) and content level (full/summary/title-only). The focused panel is what the user is currently looking at — prioritize it.
If a question can be answered from desk-context alone, answer directly without tool calls.
Each panel in desk-context names its file_id and the version you are seeing; unsaved_edits="true" means the user has edits the server has not saved yet — say so before proposing a change to that file.
If a user asks you to perform an action that requires a disabled permission, explain what you can't do and suggest they enable it in Bot Manager.`,
		activates: (turn) => (turn.scopes.length > 0 ? { active: true } : { active: false, reason: 'scope_off' }),
		awareness: (turn) => {
			if (turn.scopes.length === 0) return [];
			const blocks: BlockDraft[] = [
				{ id: 'permissions', section: 'awareness', text: permissionsBlock(profile(), turn.scopes), stable: false },
			];
			if (turn.activeWorkspace) {
				blocks.push({
					id: 'workspace',
					section: 'awareness',
					text: `The user is in workspace "${escapeXmlAttr(turn.activeWorkspace.name)}".`,
					stable: false,
				});
			}
			if (turn.panelContext?.length) {
				blocks.push({
					id: 'desk-context',
					section: 'awareness',
					text: deskContextBlock(turn.panelContext),
					stable: false,
				});
			}
			if (turn.deskLayout?.length) {
				blocks.push({ id: 'desk-layout', section: 'awareness', text: deskLayoutBlock(turn.deskLayout), stable: false });
			}
			return blocks;
		},
	};
}
