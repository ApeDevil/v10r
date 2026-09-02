<!--
	The dock-panel empty state. Deliberately NOT `composites/empty-state/EmptyState.svelte`:
	that one is a page-level state (18.75rem min-height, fluid-lg title, primary-tinted icon),
	which would dwarf a dock leaf. Same prop names so the two read as one family.
-->
<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	icon?: string;
	title: string;
	description?: string;
	children?: Snippet;
}

let { icon = 'i-lucide-file', title, description, children }: Props = $props();
</script>

<div class="empty-state">
	{#if icon}<span class={`empty-icon ${icon}`}></span>{/if}
	<p class="empty-title">{title}</p>
	{#if description}<p class="empty-description">{description}</p>{/if}
	{#if children}
		<div class="empty-actions">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		text-align: center;
		padding: 32px;
	}

	.empty-icon {
		font-size: 40px;
		color: var(--color-muted);
		opacity: 0.3;
	}

	.empty-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-muted);
	}

	.empty-description {
		font-size: 12px;
		color: var(--color-muted);
		opacity: 0.7;
	}

	.empty-actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
</style>
