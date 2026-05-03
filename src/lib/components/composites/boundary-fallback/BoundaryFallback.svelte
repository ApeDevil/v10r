<script lang="ts">
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

interface Props {
	title?: string;
	description?: string;
	minHeight?: string;
	reset: () => void;
}

let { title = m.composites_boundary_fallback_title(), description, minHeight, reset }: Props = $props();
</script>

<div class="boundary-fallback" style:min-height={minHeight} role="alert">
	<div class="boundary-icon" aria-hidden="true">
		<span class="i-lucide-triangle-alert"></span>
	</div>

	<p class="boundary-title">{title}</p>

	{#if description}
		<p class="boundary-description">{description}</p>
	{/if}

	<Button variant="ghost" size="sm" onclick={reset}>
		<span class="i-lucide-rotate-cw mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
		{m.composites_boundary_fallback_retry()}
	</Button>
</div>

<style>
	.boundary-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--spacing-6);
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.boundary-icon {
		font-size: 1.5rem;
		color: var(--color-warning, #f59e0b);
		margin-bottom: var(--spacing-3);
	}

	.boundary-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-1) 0;
	}

	.boundary-description {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-4) 0;
		max-width: 20rem;
		line-height: 1.5;
	}
</style>
