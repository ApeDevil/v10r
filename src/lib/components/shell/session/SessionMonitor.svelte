<script lang="ts">
/**
 * Session lifecycle monitor
 * Orchestrates session expiry warnings and re-authentication flow.
 * Sessions auto-renew via Better Auth's updateAge — no manual extend needed.
 */

import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { localizeHref } from '$lib/i18n';
import { getModals } from '$lib/state';
import type { Session } from '$lib/state/session.svelte';
import { setSessionContext } from '$lib/state/session.svelte';
import SessionExpiryModal from './SessionExpiryModal.svelte';
import SessionWarningBanner from './SessionWarningBanner.svelte';

type Props = {
	session: Session;
};

let { session }: Props = $props();

// Create session state with initial session
const sessionState = setSessionContext(session);
const modals = getModals();

// Track initial session to detect actual changes (not just initial hydration)
let lastExpiresAt = session?.expiresAt?.toString() ?? null;

// Update session state when prop changes (skip initial render - already set by setSessionContext)
$effect(() => {
	const currentExpiresAt = session?.expiresAt?.toString() ?? null;
	if (currentExpiresAt !== lastExpiresAt) {
		lastExpiresAt = currentExpiresAt;
		sessionState.updateSession(session);
	}
});

let extending = $state(false);

// Derived states
const showWarning = $derived(sessionState.status === 'warning' && !sessionState.warningDismissed);
const showExpiryModal = $derived(sessionState.status === 'expired');

// Auto-open expiry modal when session expires
$effect(() => {
	if (showExpiryModal && !modals.isOpen('sessionExpiry')) {
		modals.open('sessionExpiry');
	}
});

// Redirect on revoked session
$effect(() => {
	if (sessionState.status === 'revoked') {
		goto(`${localizeHref('/auth/login')}?reason=revoked`);
	}
});

async function extendSession() {
	extending = true;

	try {
		// Trigger session refresh via Better Auth client
		const result = await authClient.getSession();

		if (result.data?.session) {
			sessionState.updateSession({
				expiresAt: result.data.session.expiresAt,
				user: session?.user || { id: '', email: '' },
			});
		}
	} catch (error) {
		console.error('Session refresh failed:', error);
	} finally {
		extending = false;
	}
}

function signOut() {
	goto(localizeHref('/auth/login'));
}

function dismissWarning() {
	sessionState.dismissWarning();
}

function switchUser() {
	goto(localizeHref('/auth/login'));
}

onMount(() => {
	return () => {
		// Cleanup timer on unmount
		sessionState.destroy();
	};
});
</script>

<!-- Warning banner (shown when 1-5 minutes remain) -->
{#if showWarning}
	<SessionWarningBanner
		timeRemaining={sessionState.timeRemaining}
		onExtend={extendSession}
		onSignOut={signOut}
		onDismiss={dismissWarning}
	/>
{/if}

<!-- Expiry modal (shown when session expired) -->
{#if session?.user}
	<SessionExpiryModal
		email={session.user.email}
		onSignIn={() => goto(localizeHref('/auth/login'))}
		onSwitchUser={switchUser}
	/>
{/if}
