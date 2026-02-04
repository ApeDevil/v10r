<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { goto } from '$app/navigation';

	interface QuickSearchItem {
		id: string;
		type: 'page' | 'action' | 'recent';
		label: string;
		/** CSS icon class (e.g., 'i-lucide-home') */
		icon: string;
		href?: string;
		action?: () => void;
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

	// Group by type
	let grouped = $derived({
		recent: filtered.filter((i) => i.type === 'recent'),
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
		} else if (e.key === 'Enter' && filtered[selectedIndex]) {
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

<!-- Global keyboard shortcut -->
<svelte:window
	onkeydown={(e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			open = true;
		}
	}}
/>

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
					placeholder="Search pages, actions..."
					class="flex-1 bg-transparent text-fg placeholder:text-muted focus:outline-none"
					bind:value={query}
					autofocus
				/>
				<kbd class="rounded bg-muted/20 px-2 py-0.5 text-xs text-muted">ESC</kbd>
			</div>

			<div class="max-h-80 overflow-y-auto p-2 flex flex-col gap-2">
				{#if grouped.recent.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Recent</span>
						{#each grouped.recent as item, i}
							<button
								class={cn(
									'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
									filtered.indexOf(item) === selectedIndex
										? 'bg-primary/10 text-primary'
										: 'text-fg hover:bg-muted/10'
								)}
								onclick={() => handleSelect(item)}
							>
								<span class={cn(item.icon, 'h-4 w-4')} />
								<span>{item.label}</span>
							</button>
						{/each}
					</div>
				{/if}

				{#if grouped.pages.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Pages</span>
						{#each grouped.pages as item}
							<button
								class={cn(
									'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
									filtered.indexOf(item) === selectedIndex
										? 'bg-primary/10 text-primary'
										: 'text-fg hover:bg-muted/10'
								)}
								onclick={() => handleSelect(item)}
							>
								<span class={cn(item.icon, 'h-4 w-4')} />
								<span>{item.label}</span>
							</button>
						{/each}
					</div>
				{/if}

				{#if grouped.actions.length > 0}
					<div>
						<span class="px-2 text-xs font-medium text-muted">Actions</span>
						{#each grouped.actions as item}
							<button
								class={cn(
									'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
									filtered.indexOf(item) === selectedIndex
										? 'bg-primary/10 text-primary'
										: 'text-fg hover:bg-muted/10'
								)}
								onclick={() => handleSelect(item)}
							>
								<span class={cn(item.icon, 'h-4 w-4')} />
								<span>{item.label}</span>
							</button>
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
