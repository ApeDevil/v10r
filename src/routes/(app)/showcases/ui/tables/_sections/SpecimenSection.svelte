<script lang="ts">
import {
	Badge,
	Table,
	Body as TableBody,
	Cell as TableCell,
	Header as TableHeader,
	HeaderCell as TableHeaderCell,
	Row as TableRow,
} from '$lib/components';
import { Button } from '$lib/components/primitives';
import { EMPLOYEES, type Status } from '../_data/mock-data';

let selected = $state<Set<string>>(new Set());
let headerCheckbox = $state<HTMLInputElement | null>(null);

let allSelected = $derived(selected.size === EMPLOYEES.length && EMPLOYEES.length > 0);
let someSelected = $derived(selected.size > 0 && !allSelected);

$effect(() => {
	if (headerCheckbox) {
		headerCheckbox.indeterminate = someSelected;
	}
});

function toggleAll() {
	if (allSelected || someSelected) {
		selected = new Set();
	} else {
		selected = new Set(EMPLOYEES.map((e) => e.id));
	}
}

function toggleRow(id: string) {
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

function statusVariant(status: Status) {
	if (status === 'active') return 'success' as const;
	if (status === 'on-leave') return 'warning' as const;
	return 'error' as const;
}
</script>

<section id="tbl-specimen" class="section">
	<h2 class="section-title">Specimen</h2>
	<p class="section-description">Scientific catalog with checkbox row selection. Header checkbox supports indeterminate state for partial selection.</p>

	<div class="demos">
		<div class="specimen-frame">
			{#if selected.size > 0}
				<div class="selection-toolbar">
					<span class="selection-count">{selected.size} selected</span>
					<Button variant="ghost" size="sm" onclick={clearSelection}>Clear selection</Button>
				</div>
			{/if}

			<div class="table-container">
				<Table>
					<TableHeader>
						<TableRow hoverable={false}>
							<TableHeaderCell class="w-12">
								<input
									type="checkbox"
									bind:this={headerCheckbox}
									checked={allSelected}
									aria-checked={someSelected ? 'mixed' : allSelected}
									aria-label="Select all"
									onchange={toggleAll}
									class="row-checkbox"
								/>
							</TableHeaderCell>
							<TableHeaderCell>Name</TableHeaderCell>
							<TableHeaderCell>Department</TableHeaderCell>
							<TableHeaderCell>Rating</TableHeaderCell>
							<TableHeaderCell class="text-right">Projects</TableHeaderCell>
							<TableHeaderCell>Status</TableHeaderCell>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each EMPLOYEES as emp (emp.id)}
							<TableRow class={selected.has(emp.id) ? 'row-selected' : ''}>
								<TableCell>
									<input
										type="checkbox"
										checked={selected.has(emp.id)}
										aria-label="Select {emp.name}"
										onchange={() => toggleRow(emp.id)}
										class="row-checkbox"
									/>
								</TableCell>
								<TableCell class="font-medium">{emp.name}</TableCell>
								<TableCell>{emp.department}</TableCell>
								<TableCell>
									<span class="rating" aria-label="{emp.rating} out of 5 stars">
										{#each Array(5) as _, i}
											<span class="i-lucide-star star" class:filled={i < emp.rating} ></span>
										{/each}
									</span>
								</TableCell>
								<TableCell class="text-right tabular-nums">{emp.projects}</TableCell>
								<TableCell>
									<Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
								</TableCell>
							</TableRow>
						{/each}
						{#if EMPLOYEES.length === 0}
							<TableRow hoverable={false}>
								<TableCell class="empty-text" colspan={6}>
									No specimens catalogued.
								</TableCell>
							</TableRow>
						{/if}
					</TableBody>
				</Table>
			</div>
		</div>
	</div>
</section>

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

	.specimen-frame {
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.selection-toolbar {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		margin-bottom: var(--spacing-4);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.selection-count {
		font-weight: 600;
		color: var(--color-fg);
	}

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.row-checkbox {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: var(--color-primary);
	}

	:global(.row-selected) {
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
	}

	.rating {
		display: inline-flex;
		gap: 1px;
	}

	.star {
		width: 0.875rem;
		height: 0.875rem;
		color: var(--color-border);
	}

	.star.filled {
		color: var(--color-warning);
	}

	:global(.empty-text) {
		text-align: center;
		color: var(--color-muted);
		font-style: italic;
	}
</style>
