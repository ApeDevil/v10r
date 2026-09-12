/**
 * The live desk-bot sessions of this tab, keyed by user + workspace + panel.
 *
 * Deliberately AI-SDK-free and outside `components/desk`: `SessionMonitor` (shell, mounted
 * on every page) tears the sessions down on logout through this module, so the shell
 * bundle must not pay for `ai` and `@ai-sdk/svelte` — those load with the desk route,
 * where `components/desk/panels/bot/desk-bot-session.svelte.ts` creates the sessions and
 * registers them here. Sibling of `chatbot-session.svelte.ts` for the same reason.
 */
interface LiveSession {
	destroy(): void;
}

const sessions = new Map<string, LiveSession>();

export function sessionKey(userId: string, workspaceId: string, panelId: string): string {
	return JSON.stringify([userId, workspaceId, panelId]);
}

/** The registered session for `key`, or the one `create` makes — created once per tab. */
export function liveDeskBotSession<T extends LiveSession>(key: string, create: () => T): T {
	let session = sessions.get(key) as T | undefined;
	if (!session) {
		session = create();
		sessions.set(key, session);
	}
	return session;
}

/** Logout / session expiry: no thread of the previous user survives into the next one. */
export function resetDeskBotSessions(): void {
	for (const session of sessions.values()) session.destroy();
	sessions.clear();
}
