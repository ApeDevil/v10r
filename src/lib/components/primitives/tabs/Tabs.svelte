<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

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

<TabsPrimitive.Root bind:value class={cn('w-full flex flex-col gap-4', className)}>
	<TabsPrimitive.List
		class="inline-flex h-10 items-center justify-center rounded-md bg-muted/20 p-1"
	>
		{#each tabs as tab}
			<TabsPrimitive.Trigger
				value={tab.value}
				disabled={tab.disabled}
				class={cn(
					'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5',
					'text-fluid-sm font-medium ring-offset-bg transition-all',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
					'disabled:pointer-events-none disabled:opacity-50',
					'data-[state=active]:bg-bg data-[state=active]:text-fg data-[state=active]:shadow-sm',
					'data-[state=inactive]:text-muted'
				)}
			>
				{tab.label}
			</TabsPrimitive.Trigger>
		{/each}
	</TabsPrimitive.List>

	{#each tabs as tab}
		<TabsPrimitive.Content
			value={tab.value}
			class="ring-offset-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
		>
			{@render tab.content()}
		</TabsPrimitive.Content>
	{/each}
</TabsPrimitive.Root>
