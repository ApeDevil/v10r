<script lang="ts">
/**
 * Session expiry warning banner
 * Shows when <5 minutes remain, allows extension or sign out
 */

import * as m from '$lib/paraglide/messages';

type Props = {
	timeRemaining: number; // seconds
	onExtend: () => Promise<void>;
	onSignOut: () => void;
	onDismiss: () => void;
};

let { timeRemaining, onExtend, onSignOut, onDismiss }: Props = $props();

let extending = $state(false);

// Format time as MM:SS
const formattedTime = $derived.by(() => {
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
		<span class="i-lucide-timer text-2xl leading-none" aria-hidden="true"></span>

		<div class="banner-text">
			<strong class="banner-title">{m.session_warning_title()}</strong>
			<span class="banner-time">{m.session_warning_body({ time: formattedTime })}</span>
		</div>

		<div class="banner-actions">
			<button
				type="button"
				class="btn-extend"
				onclick={handleExtend}
				disabled={extending}
				aria-label={m.session_warning_extend()}
			>
				{extending ? m.session_warning_extending() : m.session_warning_extend()}
			</button>

			<button
				type="button"
				class="btn-signout"
				onclick={onSignOut}
				disabled={extending}
				aria-label={m.shell_sign_out()}
			>
				{m.shell_sign_out()}
			</button>

			<button
				type="button"
				class="btn-dismiss"
				onclick={onDismiss}
				disabled={extending}
				aria-label={m.session_warning_dismiss()}
			>
				<span class="i-lucide-x"></span>
			</button>
		</div>
	</div>
</div>

<style>
	.session-banner {
		position: fixed;
		top: 3px; /* Below navigation progress bar */
		left: 0;
		right: 0;
		z-index: calc(var(--z-modal) - 1);
		background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-warning-hover) 100%);
		color: white;
		box-shadow: var(--shadow-glow-warning);
		animation: slideDown var(--duration-normal) var(--ease-out);
	}

	.banner-content {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3) var(--spacing-4);
		max-width: var(--layout-max-width);
		margin: 0 auto;
	}

	.banner-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: 0.875rem;
	}

	.banner-title {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.banner-time {
		opacity: 0.95;
		font-family: ui-monospace, monospace;
		font-weight: 500;
	}

	.banner-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.btn-extend {
		padding: var(--spacing-2) var(--spacing-4);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		white-space: nowrap;
		background: white;
		color: var(--color-warning-hover);
	}

	.btn-extend:hover:not(:disabled) {
		background: var(--color-warning-light);
		transform: translateY(-1px);
	}

	.btn-extend:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-signout {
		padding: var(--spacing-2) var(--spacing-4);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		white-space: nowrap;
		background: rgb(255 255 255 / 0.2);
		color: white;
		backdrop-filter: blur(4px);
	}

	.btn-signout:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.3);
	}

	.btn-signout:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-dismiss {
		padding: var(--spacing-2);
		border: none;
		border-radius: var(--radius-md);
		font-size: 1.25rem;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: transparent;
		color: white;
		opacity: 0.8;
	}

	.btn-dismiss:hover:not(:disabled) {
		opacity: 1;
		background: rgb(255 255 255 / 0.15);
	}

	.btn-dismiss:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
			gap: var(--spacing-3);
		}

		.banner-actions {
			width: 100%;
			justify-content: space-between;
		}

		.btn-extend,
		.btn-signout {
			flex: 1;
			padding: var(--spacing-2) var(--spacing-3);
		}

		.btn-dismiss {
			flex: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.btn-extend:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
