<script lang="ts">
	import { cn } from '$lib/utils/cn';

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
	let open = $state(false);
	let highlightedIndex = $state(0);

	// Filter options based on input
	let filteredOptions = $derived(
		inputValue
			? options.filter((opt) => opt.label.toLowerCase().includes(inputValue.toLowerCase()))
			: options
	);

	// Get selected option label
	let selectedLabel = $derived(
		options.find((opt) => opt.value === selected)?.label ?? ''
	);

	function handleSelect(option: Option) {
		if (!option.disabled) {
			selected = option.value;
			onSelectedChange?.(option.value);
			inputValue = '';
			open = false;
		}
	}

	function handleClear() {
		selected = undefined;
		inputValue = '';
		onSelectedChange?.(undefined);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;

		if (e.key === 'Escape') {
			open = false;
			inputValue = '';
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!open) {
				open = true;
			} else {
				highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		} else if (e.key === 'Enter' && open && filteredOptions[highlightedIndex]) {
			e.preventDefault();
			handleSelect(filteredOptions[highlightedIndex]);
		}
	}

	// Reset highlighted index when filtered options change
	$effect(() => {
		if (filteredOptions.length > 0) {
			highlightedIndex = 0;
		}
	});
</script>

<div class="relative w-full">
	<div class="relative">
		<input
			type="text"
			class={cn(
				'flex h-10 w-full items-center justify-between rounded-md border border-border bg-bg px-3 py-2 pr-10',
				'text-fluid-sm text-fg placeholder:text-muted',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			placeholder={selected ? selectedLabel : placeholder}
			bind:value={inputValue}
			{disabled}
			onfocus={() => (open = true)}
			onblur={() => setTimeout(() => (open = false), 200)}
			onkeydown={handleKeydown}
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

	{#if open && !disabled}
		<div
			class="absolute z-dropdown top-full max-h-80 w-full overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg"
			style="margin-top: 0.25rem;"
		>
			<div class="max-h-80 overflow-y-auto p-1">
				{#each filteredOptions as option, index (option.value)}
					<button
						type="button"
						class={cn(
							'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left',
							'text-fluid-sm text-fg outline-none transition-colors',
							index === highlightedIndex && 'bg-muted/10',
							option.disabled && 'pointer-events-none opacity-50'
						)}
						onclick={() => handleSelect(option)}
						onmouseenter={() => (highlightedIndex = index)}
					>
						{option.label}
						{#if selected === option.value}
							<span class="i-lucide-check ml-auto h-4 w-4" />
						{/if}
					</button>
				{:else}
					<div class="py-6 text-center text-fluid-sm text-muted">No results found.</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
