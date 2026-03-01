<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { goto } from '$app/navigation';

	interface QuickSearchItem {
		id: string;
		type: 'page' | 'action' | 'recent' | 'panel';
		label: string;
		/** CSS icon class (e.g., 'i-lucide-home') */
		icon: string;
		href?: string;
		action?: () => void;
		secondary?: {
			icon: string;
			label: string;
			action: () => void;
		};
		/** Sub-label hint (e.g., "Opens in Desk") */
		hint?: string;
	}

	interface Props {
		open: boolean;
		items: QuickSearchItem[];
	}

	let { open = $bindable(false), items }: Props = $props();

	let query = $state('');
	let selectedIndex = $state(0);

	// Filter items based on query
	let filtered = $derived(
		query
			? items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
			: items
	);

	// Group by type — panels between recent and pages
	let grouped = $derived({
		recent: filtered.filter((i) => i.type === 'recent'),
		panels: filtered.filter((i) => i.type === 'panel'),
		pages: filtered.filter((i) => i.type === 'page'),
		actions: filtered.filter((i) => i.type === 'action')
	});

	function handleSelect(item: QuickSearchItem) {
		open = false;
		query = '';
		if (item.href) {
			goto(item.href);
		} else if (item.action) {
			item.action();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		const total = filtered.length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % total;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + total) % total;
		} else if (e.key === 'Tab' && !e.shiftKey) {
			// Tab focuses the secondary button of the selected item
			const selected = filtered[selectedIndex];
			if (selected?.secondary) {
				e.preventDefault();
				const btn = document.querySelector(`.qs-item-row[data-index="${selectedIndex}"] .qs-secondary-btn`) as HTMLButtonElement | null;
				btn?.focus();
			}
		} else if (e.key === 'Enter' && filtered[selectedIndex]) {
			// Don't fire primary if a secondary button is focused
			if ((e.target as HTMLElement)?.classList?.contains('qs-secondary-btn')) return;
			e.preventDefault();
			handleSelect(filtered[selectedIndex]);
		}
	}

	// Reset on open
	$effect(() => {
		if (open) {
			query = '';
			selectedIndex = 0;
		}
	});
</script>

{#snippet itemRow(item: QuickSearchItem)}
	{@const idx = filtered.indexOf(item)}
	{@const selected = idx === selectedIndex}
	<div
		class={cn('qs-item-row', selected && 'selected')}
		data-index={idx}
	>
		<button
			class={cn(
				'qs-item flex w-full items-center gap-3 rounded-md px-3 text-left',
				selected ? 'selected text-primary' : 'text-fg',
				item.hint ? 'py-1.5' : 'py-2'
			)}
			onclick={() => handleSelect(item)}
		>
			<span class={cn(item.icon, 'h-4 w-4 shrink-0')} />
			<span class="flex flex-col min-w-0">
				<span>{item.label}</span>
				{#if item.hint}
					<span class="qs-hint">{item.hint}</span>
				{/if}
			</span>
		</button>
		{#if item.secondary}
			<button
				class="qs-secondary-btn"
				tabindex={-1}
				title={item.secondary.label}
				onclick={(e: MouseEvent) => {
					e.stopPropagation();
					open = false;
					query = '';
					item.secondary!.action();
				}}
			>
				<span class={cn(item.secondary.icon, 'h-3.5 w-3.5')} />
			</button>
		{/if}
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-overlay bg-black/50" />
		<Dialog.Content
			class={cn(
				'fixed left-1/2 top-1/4 z-modal -translate-x-1/2',
				'w-full max-w-lg rounded-lg border border-border bg-surface-3 shadow-xl'
			)}
			onkeydown={handleKeydown}
		>
			<div class="flex items-center gap-3 border-b border-border px-4 py-3">
				<span class="i-lucide-search h-5 w-5 text-muted" />
				<input
					type="text"
					placeholder="Search pages, panels, actions..."
					class="qs-search-input flex-1 text-fluid-base text-fg placeholder:text-muted focus:outline-none"
					bind:value={query}
					autofocus
				/>
				<kbd class="qs-kbd rounded px-2 py-0.5 text-xs text-muted">ESC</kbd>
			</div>

			<div class="max-h-80 overflow-y-auto p-2 flex flex-col gap-2">
				{#if grouped.recent.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Recent</span>
						{#each grouped.recent as item}
							{@render itemRow(item)}
						{/each}
					</div>
				{/if}

				{#if grouped.panels.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Panels</span>
						{#each grouped.panels as item}
							{@render itemRow(item)}
						{/each}
					</div>
				{/if}

				{#if grouped.pages.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Pages</span>
						{#each grouped.pages as item}
							{@render itemRow(item)}
						{/each}
					</div>
				{/if}

				{#if grouped.actions.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Actions</span>
						{#each grouped.actions as item}
							{@render itemRow(item)}
						{/each}
					</div>
				{/if}

				{#if filtered.length === 0}
					<div class="py-8 text-center text-muted">No results for "{query}"</div>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.qs-search-input {
		background: transparent;
		border: none;
	}

	.qs-kbd {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
	}

	/* Row wrapper for item + secondary button */
	.qs-item-row {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: var(--radius-md);
	}

	.qs-item-row:not(.selected):hover {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.qs-item-row.selected {
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.qs-item-row .qs-item {
		flex: 1;
		min-width: 0;
	}

	.qs-item-row.selected .qs-item {
		color: var(--color-primary);
	}

	/* Hint sub-label */
	.qs-hint {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.2;
	}

	/* Secondary action button */
	.qs-secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background: transparent;
		cursor: pointer;
		opacity: 0;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.qs-secondary-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.qs-secondary-btn:focus-visible {
		opacity: 1;
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.qs-item-row:hover .qs-secondary-btn,
	.qs-item-row.selected .qs-secondary-btn,
	.qs-item-row:focus-within .qs-secondary-btn {
		opacity: 1;
	}
</style>
