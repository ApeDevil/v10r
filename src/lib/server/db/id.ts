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
	/** Desk file: fil_a8f3e1b2c4d9 */
	file: () => `fil_${shortId()}`,
	/** Desk spreadsheet: spr_a8f3e1b2c4d9 */
	spreadsheet: () => `spr_${shortId()}`,
	/** Desk theme preset: dtp_a8f3e1b2c4d9 */
	themePreset: () => `dtp_${shortId()}`,
	/** Generic UUID */
	uuid: () => crypto.randomUUID(),
} as const;
