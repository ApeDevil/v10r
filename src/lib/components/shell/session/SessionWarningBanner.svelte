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
	<div class="banner-content">
		<div class="banner-icon" aria-hidden="true">⏱️</div>

		<div class="banner-message">
			<strong>Session expiring soon</strong>
			<span>Your session will expire in {formattedTime()}</span>
		</div>

		<div class="banner-actions">
			<button
				type="button"
				class="btn-extend"
				onclick={handleExtend}
				disabled={extending}
				aria-label="Extend session"
			>
				{extending ? 'Extending...' : 'Extend Session'}
			</button>

			<button
				type="button"
				class="btn-signout"
				onclick={onSignOut}
				disabled={extending}
				aria-label="Sign out"
			>
				Sign Out
			</button>

			<button
				type="button"
				class="btn-dismiss"
				onclick={onDismiss}
				disabled={extending}
				aria-label="Dismiss warning"
			>
				✕
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

	.banner-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.banner-icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.banner-message {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
	}

	.banner-message strong {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.banner-message span {
		opacity: 0.95;
		font-family: 'Courier New', monospace;
		font-weight: 500;
	}

	.banner-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-extend {
		background: white;
		color: #d97706;
	}

	.btn-extend:hover:not(:disabled) {
		background: #fef3c7;
		transform: translateY(-1px);
	}

	.btn-signout {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		backdrop-filter: blur(8px);
	}

	.btn-signout:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.3);
	}

	.btn-dismiss {
		background: transparent;
		color: white;
		padding: 0.5rem;
		font-size: 1.25rem;
		opacity: 0.8;
	}

	.btn-dismiss:hover:not(:disabled) {
		opacity: 1;
		background: rgba(255, 255, 255, 0.15);
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

	/* Mobile responsive */
	@media (max-width: 640px) {
		.banner-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.banner-actions {
			width: 100%;
			justify-content: space-between;
		}

		button {
			flex: 1;
			padding: 0.625rem;
		}

		.btn-dismiss {
			flex: 0;
		}
	}
</style>
