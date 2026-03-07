<script lang="ts">
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell
	} from '$lib/components';
	import { EMPLOYEES, formatSalary, formatDate, type SortKey, type SortDirection } from '../_data/mock-data';

	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state<SortDirection>('asc');

	const columns: { key: SortKey; label: string; align?: 'right' }[] = [
		{ key: 'name', label: 'Name' },
		{ key: 'department', label: 'Department' },
		{ key: 'role', label: 'Role' },
		{ key: 'salary', label: 'Salary', align: 'right' },
		{ key: 'startDate', label: 'Start Date' }
	];

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			if (sortDir === 'asc') {
				sortDir = 'desc';
			} else {
				sortKey = null;
				sortDir = 'asc';
			}
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function ariaSortValue(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

	let sorted = $derived.by(() => {
		if (!sortKey) return EMPLOYEES;
		const key = sortKey;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...EMPLOYEES].sort((a, b) => {
			const av = a[key];
			const bv = b[key];
			if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
			return String(av).localeCompare(String(bv)) * dir;
		});
	});
</script>

<section id="tbl-ledger" class="section">
	<h2 class="section-title">Ledger</h2>
	<p class="section-description">Classical financial ledger with click-to-sort columns. Three-state toggle: ascending, descending, unsorted.</p>

	<div class="demos">
		<div class="ledger-frame">
				<div class="table-container">
					<Table>
						<TableHeader>
							<TableRow hoverable={false}>
								{#each columns as col}
									<TableHeaderCell class={col.align === 'right' ? 'text-right' : ''}>
										<button
											class="sort-btn"
											class:active={sortKey === col.key}
											onclick={() => toggleSort(col.key)}
											aria-sort={ariaSortValue(col.key)}
										>
											{col.label}
											{#if sortKey === col.key}
												{#if sortDir === 'asc'}
													<span class="i-lucide-chevron-up sort-icon" />
												{:else}
													<span class="i-lucide-chevron-down sort-icon" />
												{/if}
											{:else}
												<span class="i-lucide-chevrons-up-down sort-icon idle" />
											{/if}
										</button>
									</TableHeaderCell>
								{/each}
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each sorted as emp (emp.id)}
								<TableRow>
									<TableCell>{emp.name}</TableCell>
									<TableCell>{emp.department}</TableCell>
									<TableCell>{emp.role}</TableCell>
									<TableCell class="text-right tabular-nums">{formatSalary(emp.salary)}</TableCell>
									<TableCell>{formatDate(emp.startDate)}</TableCell>
								</TableRow>
							{/each}
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

	.ledger-frame {
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		font-weight: 600;
		white-space: nowrap;
	}

	.sort-btn:hover {
		color: var(--color-primary);
	}

	.sort-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.sort-icon {
		width: 0.875rem;
		height: 0.875rem;
		flex-shrink: 0;
	}

	.sort-icon.idle {
		opacity: 0.4;
	}

	.sort-btn:hover .sort-icon.idle {
		opacity: 0.7;
	}

	.sort-btn.active {
		color: var(--color-primary);
	}
</style>
