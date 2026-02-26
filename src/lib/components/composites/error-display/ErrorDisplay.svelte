<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/primitives';

	interface Props {
		status: number;
		message?: string;
		errorId?: string;
		context?: 'default' | 'showcase' | 'app' | 'auth';
		actions?: Snippet;
		children?: Snippet;
	}

	let { status, message, errorId, context = 'default', actions, children }: Props = $props();

	const icon = $derived.by(() => {
		if (status === 404) return 'i-lucide-compass';
		if (status === 403) return 'i-lucide-shield-off';
		if (status >= 500) return 'i-lucide-server-crash';
		return 'i-lucide-triangle-alert';
	});

	const heading = $derived.by(() => {
		if (status === 404) return "This page doesn't exist";
		if (status === 403) return "You don't have access";
		if (status >= 500) return 'Something went wrong';
		return 'An error occurred';
	});

	const showMessage = $derived(
		message && !message.includes('\n') && message.length < 200
	);

	let copied = $state(false);

	function copyErrorId() {
		if (errorId) {
			navigator.clipboard.writeText(errorId);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}
</script>

<div class="error-display" role="alert">
	<code class="error-badge">{status}</code>

	<div class="error-icon" aria-hidden="true">
		<span class={icon}></span>
	</div>

	<h1 class="error-heading">{heading}</h1>

	{#if showMessage}
		<p class="error-message">{message}</p>
	{/if}

	{#if errorId && status >= 500}
		<div class="error-id">
			<span class="error-id-label">Error ID:</span>
			<code class="error-id-value">{errorId}</code>
			<button class="error-id-copy" onclick={copyErrorId} aria-label="Copy error ID">
				<span class={copied ? 'i-lucide-check' : 'i-lucide-copy'}></span>
			</button>
		</div>
	{/if}

	<div class="error-actions">
		{#if actions}
			{@render actions()}
		{:else if status >= 500}
			<Button onclick={() => location.reload()}>Try again</Button>
			<Button variant="ghost" onclick={() => goto('/')}>Go home</Button>
		{:else}
			<Button onclick={() => goto('/')}>Go home</Button>
			<Button variant="ghost" onclick={() => history.back()}>Go back</Button>
		{/if}
	</div>

	{#if children}
		<div class="error-extra">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.error-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: calc(100vh - 4rem);
		padding: var(--spacing-8) var(--spacing-4);
		max-width: 32rem;
		margin: 0 auto;
	}

	.error-badge {
		font-size: var(--text-fluid-sm);
		font-family: ui-monospace, monospace;
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-muted);
		margin-bottom: var(--spacing-5);
	}

	.error-icon {
		font-size: var(--text-fluid-4xl);
		margin-bottom: var(--spacing-4);
		opacity: 0.5;
	}

	.error-icon span {
		display: inline-block;
	}

	.error-heading {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.error-message {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-4) 0;
		line-height: 1.6;
		max-width: 25rem;
	}

	.error-id {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-6);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.error-id-value {
		font-family: ui-monospace, monospace;
		background: var(--color-subtle);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.error-id-copy {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.error-id-copy:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.error-actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		justify-content: center;
	}

	.error-extra {
		margin-top: var(--spacing-7);
		width: 100%;
	}

	@media (max-width: 640px) {
		.error-display {
			padding: var(--spacing-7) var(--spacing-4);
			min-height: calc(100vh - 3rem);
		}

		.error-icon {
			font-size: var(--text-fluid-3xl);
		}

		.error-heading {
			font-size: var(--text-fluid-xl);
		}

		.error-actions {
			flex-direction: column;
			width: 100%;
		}
	}
</style>
