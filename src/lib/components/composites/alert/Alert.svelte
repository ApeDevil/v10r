<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'info' | 'success' | 'warning' | 'error';
		title?: string;
		description?: string;
		children?: Snippet;
		closable?: boolean;
		onclose?: () => void;
		class?: string;
	}

	let {
		variant = 'info',
		title,
		description,
		children,
		closable = false,
		onclose,
		class: className
	}: Props = $props();

	let visible = $state(true);

	const iconClasses = {
		info: 'i-lucide-info',
		success: 'i-lucide-check-circle',
		warning: 'i-lucide-alert-triangle',
		error: 'i-lucide-x-circle'
	};

	function handleClose() {
		visible = false;
		onclose?.();
	}
</script>

{#if visible}
	<div
		class={cn('alert', `alert-${variant}`, className)}
		role="alert"
	>
		<span class={cn(iconClasses[variant], 'alert-icon')} />

		<div class="alert-content">
			{#if title}
				<h5 class="alert-title">{title}</h5>
			{/if}

			{#if description}
				<p class="alert-description">{description}</p>
			{/if}

			{#if children}
				<div class="alert-body">
					{@render children()}
				</div>
			{/if}
		</div>

		{#if closable}
			<button
				onclick={handleClose}
				class="alert-close"
				aria-label="Close alert"
			>
				<span class="i-lucide-x alert-close-icon" />
			</button>
		{/if}
	</div>
{/if}

<style>
	.alert {
		position: relative;
		display: flex;
		gap: var(--spacing-3);
		border-radius: var(--radius-lg);
		border: 1px solid;
		padding: var(--spacing-4);
	}

	.alert-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.alert-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		flex: 1;
	}

	.alert-title {
		font-weight: 600;
		margin: 0;
	}

	.alert-description {
		font-size: var(--text-fluid-sm);
		opacity: 0.9;
		margin: 0;
	}

	.alert-body {
		padding-top: var(--spacing-1);
	}

	.alert-close {
		flex-shrink: 0;
		opacity: 0.7;
		cursor: pointer;
		border: none;
		background: none;
		color: inherit;
		padding: 0;
		border-radius: var(--radius-sm);
	}

	.alert-close:hover {
		opacity: 1;
	}

	.alert-close:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.alert-close-icon {
		width: 1rem;
		height: 1rem;
		display: block;
	}

	/* Variant: info */
	.alert-info {
		border-color: var(--color-info);
		background: var(--color-info-bg);
		color: var(--color-info-fg);
	}

	/* Variant: success */
	.alert-success {
		border-color: var(--color-success);
		background: var(--color-success-bg);
		color: var(--color-success-fg);
	}

	/* Variant: warning */
	.alert-warning {
		border-color: var(--color-warning);
		background: var(--color-warning-bg);
		color: var(--color-warning-fg);
	}

	/* Variant: error */
	.alert-error {
		border-color: var(--color-error);
		background: var(--color-error-bg);
		color: var(--color-error-fg);
	}
</style>
