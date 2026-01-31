<script lang="ts">
	/**
	 * Toast notification container with auto-dismiss and transitions.
	 * Position: Fixed top-right (desktop), top-center full-width (mobile)
	 */

	import { fly } from 'svelte/transition';
	import { getToast } from '$lib/stores/toast.svelte';

	const toast = getToast();

	// Limit visible toasts to 5
	const visibleToasts = $derived(toast.toasts.slice(0, 5));

	// Auto-dismiss durations by type (ms)
	const durations = {
		success: 5000,
		error: 8000,
		warning: 6000,
		info: 5000,
	};

	// Toast icons
	const icons = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ',
	};
</script>

{#if visibleToasts.length > 0}
	<div class="toast-container" role="region" aria-live="polite" aria-label="Notifications">
		{#each visibleToasts as t (t.id)}
			<div
				class="toast toast-{t.type}"
				transition:fly={{ x: 300, duration: 250 }}
				role="status"
				aria-atomic="true"
			>
				<div class="toast-icon">{icons[t.type]}</div>
				<div class="toast-message">{t.message}</div>
				<button
					class="toast-close"
					onclick={() => toast.remove(t.id)}
					aria-label="Dismiss notification"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					>
						<line x1="12" y1="4" x2="4" y2="12"></line>
						<line x1="4" y1="4" x2="12" y2="12"></line>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		z-index: var(--z-toast, 50);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		pointer-events: none;

		/* Mobile: top-center, full-width with padding */
		top: 1rem;
		left: 1rem;
		right: 1rem;
	}

	/* Desktop: top-right, max-width */
	@media (min-width: 768px) {
		.toast-container {
			top: 1rem;
			right: 1rem;
			left: auto;
			max-width: 420px;
		}
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
		pointer-events: auto;
		min-height: 3.5rem;
	}

	/* Dark mode */
	:global([data-theme='dark']) .toast {
		background: var(--color-bg);
		border-color: var(--color-border);
	}

	/* Type-specific colors */
	.toast-success {
		border-left: 4px solid var(--color-success);
	}

	.toast-error {
		border-left: 4px solid var(--color-error);
	}

	.toast-warning {
		border-left: 4px solid var(--color-warning);
	}

	.toast-info {
		border-left: 4px solid var(--color-primary);
	}

	.toast-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		font-size: 1rem;
		font-weight: 700;
		border-radius: 50%;
	}

	.toast-success .toast-icon {
		background: var(--color-success);
		color: white;
	}

	.toast-error .toast-icon {
		background: var(--color-error);
		color: white;
	}

	.toast-warning .toast-icon {
		background: var(--color-warning);
		color: white;
	}

	.toast-info .toast-icon {
		background: var(--color-primary);
		color: white;
	}

	.toast-message {
		flex: 1;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--color-fg);
	}

	.toast-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all var(--duration-fast, 150ms);
	}

	.toast-close:hover {
		background: var(--color-border);
		color: var(--color-fg);
	}

	.toast-close:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.toast {
			transition: none;
		}
	}
</style>
