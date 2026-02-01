<script lang="ts">
	/**
	 * Session expiry warning banner
	 * Shows when <5 minutes remain, allows extension or sign out
	 */

	type Props = {
		timeRemaining: number; // seconds
		onExtend: () => Promise<void>;
		onSignOut: () => void;
		onDismiss: () => void;
	};

	let { timeRemaining, onExtend, onSignOut, onDismiss }: Props = $props();

	let extending = $state(false);

	// Format time as MM:SS
	const formattedTime = $derived(() => {
		const minutes = Math.floor(timeRemaining / 60);
		const seconds = timeRemaining % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	});

	async function handleExtend() {
		extending = true;
		try {
			await onExtend();
			onDismiss(); // Close banner after successful extension
		} catch (error) {
			console.error('Failed to extend session:', error);
		} finally {
			extending = false;
		}
	}
</script>

<div class="session-banner" role="alert" aria-live="polite">
	<div class="flex items-center gap-4 px-4 py-3 max-w-[1400px] mx-auto sm:flex-col sm:items-start sm:gap-3">
		<span class="i-lucide-timer text-2xl leading-none" aria-hidden="true"></span>

		<div class="flex-1 flex flex-col gap-1 text-sm">
			<strong class="font-semibold text-[0.9375rem]">Session expiring soon</strong>
			<span class="opacity-95 font-mono font-medium">Your session will expire in {formattedTime()}</span>
		</div>

		<div class="flex items-center gap-2 sm:w-full sm:justify-between">
			<button
				type="button"
				class="px-4 py-2 border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-fast whitespace-nowrap bg-white text-[#d97706] hover:bg-[#fef3c7] hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex-1 sm:px-2.5"
				onclick={handleExtend}
				disabled={extending}
				aria-label="Extend session"
			>
				{extending ? 'Extending...' : 'Extend Session'}
			</button>

			<button
				type="button"
				class="px-4 py-2 border-none rounded-md text-sm font-medium cursor-pointer transition-all duration-fast whitespace-nowrap bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed motion-reduce:transition-none sm:flex-1 sm:px-2.5"
				onclick={onSignOut}
				disabled={extending}
				aria-label="Sign out"
			>
				Sign Out
			</button>

			<button
				type="button"
				class="bg-transparent text-white px-2 py-2 border-none text-xl opacity-80 cursor-pointer transition-all duration-fast hover:opacity-100 hover:bg-white/15 rounded-md disabled:opacity-60 disabled:cursor-not-allowed motion-reduce:transition-none sm:flex-0"
				onclick={onDismiss}
				disabled={extending}
				aria-label="Dismiss warning"
			>
				<span class="i-lucide-x"></span>
			</button>
		</div>
	</div>
</div>

<style>
	.session-banner {
		position: fixed;
		top: 3px; /* Below navigation progress bar (3px height) */
		left: 0;
		right: 0;
		z-index: 999; /* Below modals (1000), above content */
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
