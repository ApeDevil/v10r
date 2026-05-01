/**
 * Centralized ID generation — no external dependencies.
 *
 * Format: {prefix}_{12 hex chars}  (48 bits of entropy)
 * Uses platform crypto.randomUUID() under the hood.
 */

function shortId(length = 12): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, length);
}

export const createId = {
	/** Custom palette: CP_a8f3e1b2c4d9 */
	palette: () => `CP_${shortId()}`,
	/** Blog post: pst_a8f3e1b2c4d9 */
	post: () => `pst_${shortId()}`,
	/** Blog revision: rev_a8f3e1b2c4d9 */
	revision: () => `rev_${shortId()}`,
	/** Blog tag: tag_a8f3e1b2c4d9 */
	tag: () => `tag_${shortId()}`,
	/** Blog domain: dom_a8f3e1b2c4d9 */
	domain: () => `dom_${shortId()}`,
	/** Blog asset: ast_a8f3e1b2c4d9 */
	asset: () => `ast_${shortId()}`,
	/** Blog post folder: pfd_a8f3e1b2c4d9 */
	postFolder: () => `pfd_${shortId()}`,
	/** Blog asset folder: afd_a8f3e1b2c4d9 */
	assetFolder: () => `afd_${shortId()}`,
	/** Desk folder: fld_a8f3e1b2c4d9 */
	folder: () => `fld_${shortId()}`,
	/** Desk file: fil_a8f3e1b2c4d9 */
	file: () => `fil_${shortId()}`,
	/** Desk spreadsheet: spr_a8f3e1b2c4d9 */
	spreadsheet: () => `spr_${shortId()}`,
	/** Desk theme preset: dtp_a8f3e1b2c4d9 */
	themePreset: () => `dtp_${shortId()}`,
	/** Desk markdown: mkd_a8f3e1b2c4d9 */
	markdown: () => `mkd_${shortId()}`,
	/** AI tool call: tcl_a8f3e1b2c4d9 */
	toolCall: () => `tcl_${shortId()}`,
	/** AI conversation step: stp_a8f3e1b2c4d9 */
	conversationStep: () => `stp_${shortId()}`,
	/** Agent proposal (plan-before-execute): prp_a8f3e1b2c4d9 */
	agentProposal: () => `prp_${shortId()}`,
	/** Agent audit log entry: aud_a8f3e1b2c4d9 */
	agentAudit: () => `aud_${shortId()}`,
	/** Desk workspace: wsp_a8f3e1b2c4d9 */
	workspace: () => `wsp_${shortId()}`,
	/** Feedback submission: fbk_a8f3e1b2c4d9 */
	feedback: () => `fbk_${shortId()}`,
	/** Generic UUID */
	uuid: () => crypto.randomUUID(),
} as const;
