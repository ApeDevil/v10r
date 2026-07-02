/**
 * Single source of truth for parsing `ADMIN_USER_ID`.
 *
 * `ADMIN_USER_ID` is a comma-separated list of admin user ids (one per admin). IDs are
 * immutable opaque tokens, so admin can't be transferred by re-claiming an email.
 *
 * This is a **leaf module** (zero framework imports): the framework-free AI orchestrator
 * imports it directly, while `auth/guards.ts` feeds it `$env/dynamic/private` through the
 * pure `parseAdminIds`. Both share this one parser — no divergent copies.
 */

/** Parse a raw comma-separated id list: trim, drop blanks, dedupe (first-seen order). */
export function parseAdminIds(raw: string | undefined | null): string[] {
	if (!raw) return [];
	// First-seen order matters — index 0 is the canonical "system author" (see getSystemAuthorId).
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const part of raw.split(',')) {
		const id = part.trim();
		if (id && !seen.has(id)) {
			seen.add(id);
			ids.push(id);
		}
	}
	return ids;
}

/**
 * All configured admin ids, read from `process.env`. For framework-free callers (the AI
 * orchestrator). SvelteKit code should call `auth/guards.isAdmin`, which reads
 * `$env/dynamic/private` through the same `parseAdminIds`.
 */
export function getAdminUserIds(): string[] {
	return parseAdminIds(process.env.ADMIN_USER_ID);
}

/** True if the given user id is a configured admin. */
export function isAdminUserId(userId: string | null | undefined): boolean {
	if (!userId) return false;
	return getAdminUserIds().includes(userId);
}

/**
 * The canonical "system author" id — the first configured admin. File-pushed content
 * (docs, seed content) is authored by this user. Throws when no admin is configured,
 * because system-owned content has no valid owner otherwise.
 */
export function getSystemAuthorId(): string {
	const [first] = getAdminUserIds();
	if (!first) {
		throw new Error(
			'ADMIN_USER_ID is not set — cannot resolve the system author. Set it to a comma-separated list of admin user ids.',
		);
	}
	return first;
}

/**
 * Boot-time visibility. Called once from `hooks.server.ts` init so an empty/unset
 * `ADMIN_USER_ID` surfaces as a loud warning instead of two silent-yet-divergent failure
 * modes (isAdmin quietly denies everyone; getSystemAuthorId throws deep in a content push).
 */
export function logAdminConfig(): void {
	const count = getAdminUserIds().length;
	if (count === 0) {
		console.warn(
			'[admin] ADMIN_USER_ID is empty or unset — no user can reach /admin, and file-pushed content will fail to resolve a system author. Set it to a comma-separated list of admin user ids.',
		);
	}
}
