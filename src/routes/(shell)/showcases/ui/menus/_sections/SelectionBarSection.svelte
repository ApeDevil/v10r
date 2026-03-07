<script lang="ts">
	import { DemoCard } from '../../components/_components';
	import { SelectionBar } from '$lib/components/composites';
	import type { SelectionBarAction } from '$lib/components/composites/selection-bar/types';

	interface ListItem {
		id: string;
		name: string;
		email: string;
	}

	const people: ListItem[] = [
		{ id: '1', name: 'Ada Lovelace', email: 'ada@example.com' },
		{ id: '2', name: 'Grace Hopper', email: 'grace@example.com' },
		{ id: '3', name: 'Alan Turing', email: 'alan@example.com' },
		{ id: '4', name: 'Margaret Hamilton', email: 'margaret@example.com' },
		{ id: '5', name: 'Linus Torvalds', email: 'linus@example.com' },
	];

	let selected = $state<Set<string>>(new Set());

	let allSelected = $derived(selected.size === people.length && people.length > 0);
	let someSelected = $derived(selected.size > 0 && !allSelected);

	function toggleAll() {
		if (allSelected || someSelected) {
			selected = new Set();
		} else {
			selected = new Set(people.map((p) => p.id));
		}
	}

	function toggleItem(id: string) {
		const next = new Set(selected);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selected = next;
	}

	function clearSelection() {
		selected = new Set();
	}

	const actions: SelectionBarAction[] = [
		{
			label: 'Archive',
			icon: 'i-lucide-archive',
			onclick: () => {
				clearSelection();
			},
		},
		{
			label: 'Export',
			icon: 'i-lucide-download',
			onclick: () => {
				clearSelection();
			},
		},
		{
			label: 'Delete',
			icon: 'i-lucide-trash-2',
			variant: 'destructive',
			onclick: () => {
				clearSelection();
			},
		},
	];

	let headerCheckbox: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (headerCheckbox) {
			headerCheckbox.indeterminate = someSelected;
		}
	});
</script>

<section id="menu-selection-bar" class="section">
	<h2 class="section-title">Selection Bar</h2>
	<p class="section-description">
		Floating toolbar for bulk operations on selected items. Use when: users need to perform the same
		action on multiple items at once.
	</p>

	<div class="demos">
		<DemoCard
			title="Bulk Selection Actions"
			description="Select items in the list below. A floating action bar appears at the bottom of the viewport."
		>
			<div class="selection-list">
				<div class="selection-header">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={allSelected}
							bind:this={headerCheckbox}
							onchange={toggleAll}
						/>
						<span class="text-fluid-sm font-medium text-muted">Select All</span>
					</label>
				</div>

				{#each people as person (person.id)}
					{@const isSelected = selected.has(person.id)}
					<label class="selection-row" class:row-selected={isSelected}>
						<input
							type="checkbox"
							checked={isSelected}
							onchange={() => toggleItem(person.id)}
						/>
						<div class="selection-row-content">
							<span class="selection-row-name">{person.name}</span>
							<span class="selection-row-email">{person.email}</span>
						</div>
					</label>
				{/each}
			</div>
		</DemoCard>
	</div>
</section>

<SelectionBar count={selected.size} {actions} onClear={clearSelection} />

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.selection-list {
		width: 100%;
		max-width: 32rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.selection-header {
		padding: var(--spacing-2) var(--spacing-3);
		background: var(--color-subtle);
		border-bottom: 1px solid var(--color-border);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		cursor: pointer;
	}

	.selection-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-3);
		cursor: pointer;
		border-bottom: 1px solid var(--color-border);
	}

	.selection-row:last-child {
		border-bottom: none;
	}

	.selection-row:hover {
		background: color-mix(in srgb, var(--color-muted) 5%, transparent);
	}

	.selection-row.row-selected {
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.selection-row-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.selection-row-name {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}

	.selection-row-email {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
