<script lang="ts">
	/**
	 * Session expiry modal
	 * Shows when session has expired — user must sign in again.
	 * Sessions auto-renew, so this only appears after 7 days of inactivity.
	 */

	import { getModals } from '$lib/stores';

	type Props = {
		email: string;
		onSignIn: () => void;
		onSwitchUser: () => void;
	};

	let { email, onSignIn, onSwitchUser }: Props = $props();

	const modals = getModals();
</script>

{#if modals.isOpen('sessionExpiry')}
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
		<div class="modal-content">
			<div class="flex flex-col items-center gap-3 px-8 pt-8 pb-4 border-b border-border">
				<span class="i-lucide-lock text-5xl leading-none" aria-hidden="true"></span>
				<h2 id="session-modal-title" class="m-0 text-2xl font-semibold text-fg">Session Expired</h2>
			</div>

			<div class="p-8">
				<p class="m-0 mb-6 text-muted leading-relaxed">
					Your session has expired. Please sign in again to continue.
				</p>

				<div class="flex items-center gap-4 p-4 bg-subtle rounded-lg mb-6">
					<div class="avatar-circle" aria-hidden="true">
						{email.charAt(0).toUpperCase()}
					</div>
					<div>
						<div class="font-medium text-fg">{email}</div>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-3 px-8 pb-8">
				<button
					type="button"
					class="btn-primary"
					onclick={onSignIn}
					aria-label="Sign in again"
				>
					Sign In Again
				</button>

				<button
					type="button"
					class="btn-secondary"
					onclick={onSwitchUser}
					aria-label="Sign in as different user"
				>
					Sign In as Different User
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		background: var(--backdrop);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-4);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	.modal-content {
		background: var(--surface-3);
		border-radius: var(--radius-xl);
		max-width: 480px;
		width: 100%;
		box-shadow: var(--shadow-modal);
		animation: slideUp var(--duration-normal) var(--ease-out);
	}

	.avatar-circle {
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.btn-primary {
		padding: var(--spacing-3) var(--spacing-6);
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
		transform: translateY(-2px);
		box-shadow: var(--shadow-glow-primary);
	}

	.btn-secondary {
		padding: var(--spacing-3) var(--spacing-6);
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.btn-secondary:hover {
		background: var(--color-border);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.btn-primary:hover {
			transform: none;
		}
	}
</style>
