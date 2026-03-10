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
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		overflow: hidden;
	}

	.demo-header {
		padding: var(--spacing-4) var(--spacing-6);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.demo-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.demo-description {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.demo-content {
		padding: var(--spacing-7) var(--spacing-6);
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-4);
		align-items: center;
		min-height: 5rem;
	}

	.demo-code {
		border-top: 1px solid var(--color-border);
	}

	.demo-code summary {
		padding: var(--spacing-3) var(--spacing-6);
		cursor: pointer;
		user-select: none;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		transition: color var(--duration-fast);
		background: var(--color-subtle);
	}

	.demo-code summary:hover {
		color: var(--color-fg);
	}

	.demo-code pre {
		margin: 0;
		padding: var(--spacing-4) var(--spacing-6);
		overflow-x: auto;
		background: var(--color-subtle);
		border-top: 1px solid var(--color-border);
	}

	.demo-code code {
		font-family: 'Fira Code', 'Courier New', monospace;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-fg);
	}
</style>
