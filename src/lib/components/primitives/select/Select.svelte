<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		options: Option[];
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Select...',
		disabled = false,
		class: className
	}: Props = $props();

	let selectedLabel = $derived(
		options.find((opt) => opt.value === value)?.label ?? ''
	);
</script>

<SelectPrimitive.Root type="single" bind:value {disabled}>
	<SelectPrimitive.Trigger
		class={cn(
			'flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg px-3 py-2',
			'text-fluid-base text-fg',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
			'disabled:cursor-not-allowed disabled:opacity-50',
			className
		)}
	>
		<span class={cn(!value && 'text-muted')}>
			{selectedLabel || placeholder}
		</span>
		<span class="i-lucide-chevrons-up-down h-4 w-4 opacity-50" />
	</SelectPrimitive.Trigger>

	<SelectPrimitive.Portal>
		<SelectPrimitive.Content
			class="z-dropdown max-h-80 w-[var(--bits-select-anchor-width)] overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg"
			sideOffset={4}
			side="bottom"
		>
			<SelectPrimitive.Viewport class="p-1">
				{#each options as option (option.value)}
					<SelectPrimitive.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						class={cn(
							'select-item relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5',
							'text-fluid-sm text-fg outline-none',
							'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
						)}
					>
						<span>{option.label}</span>
						{#if value === option.value}
							<span class="i-lucide-check ml-auto h-4 w-4" />
						{/if}
					</SelectPrimitive.Item>
				{/each}
			</SelectPrimitive.Viewport>
		</SelectPrimitive.Content>
	</SelectPrimitive.Portal>
</SelectPrimitive.Root>

<style>
	/* UnoCSS can't apply opacity modifiers with CSS variable colors — use color-mix() */
	:global(.select-item[data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
