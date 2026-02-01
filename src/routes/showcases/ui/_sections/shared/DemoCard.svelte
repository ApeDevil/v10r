<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		class?: string;
		showCode?: boolean;
		code?: string;
	}

	let { title, description, children, class: className, showCode = false, code }: Props = $props();
	let isCodeExpanded = $state(false);
</script>

<div class={cn('demo-card', className)}>
	<div class="demo-header">
		<div>
			<h3 class="demo-title">{title}</h3>
			{#if description}
				<p class="demo-description">{description}</p>
			{/if}
		</div>
	</div>

	<div class="demo-content">
		{@render children()}
	</div>

	{#if showCode && code}
		<details bind:open={isCodeExpanded} class="demo-code">
			<summary>View code</summary>
			<pre><code>{code}</code></pre>
		</details>
	{/if}
</div>

<style>
	.demo-card {
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-bg);
		overflow: hidden;
	}

	.demo-header {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.demo-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.demo-description {
		margin: 0.25rem 0 0 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.5;
	}

	.demo-content {
		padding: 2rem 1.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		min-height: 80px;
	}

	.demo-code {
		border-top: 1px solid var(--color-border);
	}

	.demo-code summary {
		padding: 0.75rem 1.5rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-muted);
		transition: color 0.15s;
		background: var(--color-subtle);
	}

	.demo-code summary:hover {
		color: var(--color-fg);
	}

	.demo-code pre {
		margin: 0;
		padding: 1rem 1.5rem;
		overflow-x: auto;
		background: var(--color-subtle);
		border-top: 1px solid var(--color-border);
	}

	.demo-code code {
		font-family: 'Fira Code', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-fg);
	}
</style>
