<script lang="ts">
/**
 * Toast notification container with auto-dismiss and transitions.
 * Position: Fixed top-right (desktop), top-center full-width (mobile)
 * Styled to match Alert variant colors (solid status backgrounds).
 */

import { fly } from 'svelte/transition';
import { getToast } from '$lib/state/toast.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();

const toast = getToast();

// Limit visible toasts to 5
const visibleToasts = $derived(toast.items.slice(0, 5));

// Toast icon classes
const iconClasses: Record<string, string> = {
	success: 'i-lucide-check-circle',
	error: 'i-lucide-x-circle',
	warning: 'i-lucide-alert-triangle',
	info: 'i-lucide-info',
};
</script>

{#if visibleToasts.length > 0}
	<div class={cn('toast-region', className)} role="region" aria-live="polite" aria-label="Notifications">
		{#each visibleToasts as t (t.id)}
			<div
				class={cn('toast', `toast-${t.type}`)}
				transition:fly={{ x: 300, duration: 250 }}
				role="status"
				aria-atomic="true"
			>
				<span class={cn(iconClasses[t.type], 'toast-icon')}></span>
				<div class="toast-message">{t.message}</div>
				<button
					class="toast-close"
					onclick={() => toast.remove(t.id)}
					aria-label="Dismiss notification"
				>
					<span class="i-lucide-x toast-close-icon"></span>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-region {
		position: fixed;
		z-index: var(--z-toast);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		pointer-events: none;
		top: var(--spacing-4);
		left: var(--spacing-4);
		right: var(--spacing-4);
	}

	@media (min-width: 768px) {
		.toast-region {
			top: var(--spacing-4);
			right: var(--spacing-4);
			left: auto;
			max-width: 420px;
		}
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border-radius: var(--radius-lg);
		border: 1px solid;
		pointer-events: auto;
		min-height: 3.5rem;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
	}

	.toast-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.toast-message {
		flex: 1;
		font-size: var(--text-fluid-sm);
		line-height: 1.4;
	}

	.toast-close {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		background: none;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
		border-radius: var(--radius-sm);
		padding: 0;
	}

	.toast-close:hover {
		opacity: 1;
	}

	.toast-close:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px currentColor;
	}

	.toast-close-icon {
		width: 1rem;
		height: 1rem;
		display: block;
	}

	/* ── Variants (matches Alert token pattern) ── */

	.toast-info {
		border-color: var(--color-info);
		background: var(--color-info-bg);
		color: var(--color-info-fg);
	}

	.toast-success {
		border-color: var(--color-success);
		background: var(--color-success-bg);
		color: var(--color-success-fg);
	}

	.toast-warning {
		border-color: var(--color-warning);
		background: var(--color-warning-bg);
		color: var(--color-warning-fg);
	}

	.toast-error {
		border-color: var(--color-error);
		background: var(--color-error-bg);
		color: var(--color-error-fg);
	}
</style>
