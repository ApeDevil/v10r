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
	/** Generic UUID */
	uuid: () => crypto.randomUUID(),
} as const;
