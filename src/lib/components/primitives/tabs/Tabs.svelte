<script lang="ts">
import { Tabs as TabsPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface Tab {
	value: string;
	label: string;
	content: Snippet;
	disabled?: boolean;
}

interface Props {
	tabs: Tab[];
	value?: string;
	class?: string;
}

let { tabs, value = $bindable(tabs[0]?.value ?? ''), class: className }: Props = $props();
</script>

<div class="tabs-wrapper">
	<TabsPrimitive.Root bind:value class={cn('w-full flex flex-col gap-4', className)}>
		<TabsPrimitive.List class="tabs-list inline-flex items-center">
			{#each tabs as tab}
				<TabsPrimitive.Trigger
					value={tab.value}
					disabled={tab.disabled}
					class={cn(
						'tab-trigger inline-flex items-center justify-center whitespace-nowrap px-4 py-2',
						'text-fluid-sm font-medium',
						'focus-visible:outline-none',
						'disabled:pointer-events-none disabled:opacity-50'
					)}
				>
					{tab.label}
				</TabsPrimitive.Trigger>
			{/each}
		</TabsPrimitive.List>

		{#each tabs as tab}
			<TabsPrimitive.Content
				value={tab.value}
				class="focus-visible:outline-none"
			>
				{@render tab.content()}
			</TabsPrimitive.Content>
		{/each}
	</TabsPrimitive.Root>
</div>

<style>
	.tabs-wrapper :global(.tabs-list) {
		border-bottom: 1px solid var(--color-input-border);
	}

	.tabs-wrapper :global(.tab-trigger) {
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		color: var(--color-muted);
		transition: border-bottom-color 150ms ease, color 150ms ease;
	}

	.tabs-wrapper :global(.tab-trigger:hover) {
		color: var(--color-fg);
	}

	.tabs-wrapper :global(.tab-trigger[data-state='active']) {
		border-bottom-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tabs-wrapper :global(.tab-trigger[data-state='inactive']) {
		border-bottom-color: transparent;
	}

	.tabs-wrapper :global(.tab-trigger:focus-visible) {
		border-bottom-color: var(--color-primary);
	}
</style>
