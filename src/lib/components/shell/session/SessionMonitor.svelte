<script lang="ts">
	/**
	 * Session lifecycle monitor
	 * Orchestrates session expiry warnings and re-authentication flow
	 */

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/i18n';
	import type { Session } from '$lib/stores/session.svelte';
	import { setSessionContext } from '$lib/stores/session.svelte';
	import { getModals } from '$lib/stores';
	import SessionWarningBanner from './SessionWarningBanner.svelte';
	import SessionExpiryModal from './SessionExpiryModal.svelte';

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
	const showWarning = $derived(
		sessionState.status === 'warning' && !sessionState.warningDismissed
	);
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
			goto(localizeHref('/login') + '?reason=revoked');
		}
	});

	async function extendSession() {
		extending = true;

		try {
			const response = await fetch('/api/session/extend', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			if (!response.ok) {
				throw new Error('Failed to extend session');
			}

			const data = await response.json();

			// Update session with new expiry time
			sessionState.updateSession({
				expiresAt: data.expiresAt,
				user: session?.user || { id: '', email: '' },
			});
		} catch (error) {
			console.error('Session extension failed:', error);
			// Don't throw - let session expire naturally
		} finally {
			extending = false;
		}
	}

	function signOut() {
		goto(localizeHref('/logout'));
	}

	function dismissWarning() {
		sessionState.dismissWarning();
	}

	async function reauthenticate(code: string): Promise<boolean> {
		try {
			const response = await fetch('/api/session/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			});

			if (!response.ok) {
				return false;
			}

			const data = await response.json();

			// Restore session with new expiry
			sessionState.updateSession({
				expiresAt: data.expiresAt,
				user: session?.user || { id: '', email: '' },
			});

			return true;
		} catch (error) {
			console.error('Reauthentication failed:', error);
			return false;
		}
	}

	function switchUser() {
		goto(localizeHref('/login'));
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
		onReauthenticate={reauthenticate}
		onSwitchUser={switchUser}
	/>
{/if}
