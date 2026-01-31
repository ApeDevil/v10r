/**
 * Session lifecycle state management
 * Tracks session expiry and warns users before timeout
 */

import { getContext, setContext } from 'svelte';

const SESSION_CTX = Symbol('session');

type SessionStatus = 'valid' | 'warning' | 'expired' | 'revoked';

export type Session = {
	expiresAt: Date | string;
	user: { id: string; email: string; name?: string };
} | null;

type SessionState = {
	status: SessionStatus;
	expiresAt: Date | null;
	timeRemaining: number; // seconds
	warningDismissed: boolean;
};

/**
 * Create session state instance
 */
export function createSessionState(initialSession: Session | null) {
	const expiresAt = initialSession?.expiresAt
		? new Date(initialSession.expiresAt)
		: null;

	let state = $state<SessionState>({
		status: 'valid',
		expiresAt,
		timeRemaining: expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) : 0,
		warningDismissed: false,
	});

	// Timer for updating remaining time
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function startTimer() {
		if (!state.expiresAt) return;

		intervalId = setInterval(() => {
			if (!state.expiresAt) {
				stopTimer();
				return;
			}

			const now = Date.now();
			const remaining = Math.floor((state.expiresAt.getTime() - now) / 1000);

			state.timeRemaining = Math.max(0, remaining);

			// Update status based on time remaining
			if (remaining <= 0) {
				state.status = 'expired';
				stopTimer();
			} else if (remaining <= 300 && !state.warningDismissed) {
				// 5 minutes = 300 seconds
				state.status = 'warning';
			} else if (state.status === 'warning' && remaining > 300) {
				state.status = 'valid';
			}
		}, 1000); // Update every second
	}

	function stopTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	// Start timer if session exists
	if (expiresAt) {
		startTimer();
	}

	return {
		get status() {
			return state.status;
		},

		get expiresAt() {
			return state.expiresAt;
		},

		get timeRemaining() {
			return state.timeRemaining;
		},

		get warningDismissed() {
			return state.warningDismissed;
		},

		dismissWarning() {
			state.warningDismissed = true;
			if (state.timeRemaining > 300) {
				state.status = 'valid';
			}
		},

		updateSession(session: Session | null) {
			stopTimer();

			if (!session) {
				state.status = 'revoked';
				state.expiresAt = null;
				state.timeRemaining = 0;
				return;
			}

			const newExpiresAt = new Date(session.expiresAt);
			state.expiresAt = newExpiresAt;
			state.timeRemaining = Math.floor((newExpiresAt.getTime() - Date.now()) / 1000);
			state.status = 'valid';
			state.warningDismissed = false;

			startTimer();
		},

		markExpired() {
			state.status = 'expired';
			state.timeRemaining = 0;
			stopTimer();
		},

		markRevoked() {
			state.status = 'revoked';
			state.timeRemaining = 0;
			stopTimer();
		},

		destroy() {
			stopTimer();
		},
	};
}

/**
 * Set session context in component tree.
 * Call this in root layout or AppShell.
 */
export function setSessionContext(session: Session | null) {
	const sessionState = createSessionState(session);
	setContext(SESSION_CTX, sessionState);
	return sessionState;
}

/**
 * Get session state from context.
 * Use this in child components.
 */
export function getSession() {
	return getContext<ReturnType<typeof createSessionState>>(SESSION_CTX);
}
