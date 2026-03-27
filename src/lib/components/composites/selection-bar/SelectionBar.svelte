<script lang="ts">
import { cn } from '$lib/utils/cn';
import {
	selectionBarActionVariants,
	selectionBarCountVariants,
	selectionBarDismissVariants,
	selectionBarVariants,
} from './selection-bar';
import type { SelectionBarAction } from './types';

interface Props {
	count: number;
	actions: SelectionBarAction[];
	onClear: () => void;
	class?: string;
}

let { count, actions, onClear, class: className }: Props = $props();
</script>

{#if count > 0}
	<div
		class={cn(selectionBarVariants(), className)}
		role="toolbar"
		aria-label="{count} item{count === 1 ? '' : 's'} selected"
	>
		<span class={selectionBarCountVariants()}>
			{count} selected
		</span>

		<span class="bar-divider" aria-hidden="true"></span>

		{#each actions as action}
			<button
				class={selectionBarActionVariants({ variant: action.variant })}
				onclick={action.onclick}
				disabled={action.disabled}
				title={action.label}
			>
				{#if action.icon}
					<span class={cn(action.icon, 'h-4 w-4')} ></span>
				{/if}
				<span class="hidden sm:inline">{action.label}</span>
			</button>
		{/each}

		<span class="bar-divider" aria-hidden="true"></span>

		<button
			class={selectionBarDismissVariants()}
			onclick={onClear}
			title="Clear selection"
			aria-label="Clear selection"
		>
			<span class="i-lucide-x h-4 w-4" ></span>
		</button>
	</div>
{/if}

<style>
	.bar-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--color-border);
		flex-shrink: 0;
	}

	/* Hover states via color-mix (UnoCSS opacity modifiers broken with CSS vars) */
	:global(.selection-bar-action):hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	/* Scoped hover for action buttons */
	[role="toolbar"] button:not([aria-label="Clear selection"]):hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	[role="toolbar"] button[aria-label="Clear selection"]:hover {
		color: var(--color-fg);
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
