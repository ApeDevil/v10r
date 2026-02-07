<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Combobox as ComboboxPrimitive } from 'bits-ui';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		options: Option[];
		selected?: string;
		placeholder?: string;
		disabled?: boolean;
		onSelectedChange?: (value: string | undefined) => void;
		class?: string;
	}

	let {
		options,
		selected = $bindable(),
		placeholder = 'Search...',
		disabled = false,
		onSelectedChange,
		class: className
	}: Props = $props();

	let inputValue = $state('');
	let touchedSinceOpen = $state(false);

	let selectedLabel = $derived(
		options.find((opt) => opt.value === selected)?.label ?? ''
	);

	function handleClear() {
		selected = undefined;
		inputValue = '';
		onSelectedChange?.(undefined);
	}
</script>

<ComboboxPrimitive.Root
	type="single"
	bind:value={selected}
	bind:inputValue
	bind:touchedInput={touchedSinceOpen}
	{disabled}
	onValueChange={(v) => onSelectedChange?.(v)}
>
	<div class="relative w-full">
		<ComboboxPrimitive.Input
			class={cn(
				'flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg px-3 py-2 pr-10',
				'text-fluid-sm text-fg placeholder:text-muted',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			placeholder={selected ? selectedLabel : placeholder}
		/>
		<div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
			{#if selected && !disabled}
				<button
					type="button"
					class="text-muted hover:text-fg transition-colors"
					onclick={handleClear}
					tabindex="-1"
				>
					<span class="i-lucide-x h-4 w-4" />
					<span class="sr-only">Clear selection</span>
				</button>
			{/if}
			<span class="i-lucide-chevrons-up-down h-4 w-4 opacity-50 pointer-events-none" />
		</div>
	</div>

	<ComboboxPrimitive.Portal>
		<ComboboxPrimitive.Content
			class="z-dropdown max-h-80 w-[var(--bits-combobox-anchor-width)] overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg"
			sideOffset={4}
			side="bottom"
		>
			<div class="max-h-80 overflow-y-auto p-1">
				{#each options as option (option.value)}
					{@const hidden = touchedSinceOpen && !option.label.toLowerCase().includes(inputValue.toLowerCase())}
					<ComboboxPrimitive.Item
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						class={cn(
							'combobox-item relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5',
							'text-fluid-sm text-fg outline-none',
							'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
							hidden && 'hidden'
						)}
					>
						<span>{option.label}</span>
						{#if selected === option.value}
							<span class="i-lucide-check ml-auto h-4 w-4" />
						{/if}
					</ComboboxPrimitive.Item>
				{:else}
					<div class="py-6 text-center text-fluid-sm text-muted">No results found.</div>
				{/each}
			</div>
		</ComboboxPrimitive.Content>
	</ComboboxPrimitive.Portal>
</ComboboxPrimitive.Root>

<style>
	/* UnoCSS can't apply opacity modifiers with CSS variable colors — use color-mix() */
	:global(.combobox-item[data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
