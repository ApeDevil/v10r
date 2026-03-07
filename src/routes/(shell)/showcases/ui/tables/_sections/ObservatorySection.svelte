<script lang="ts">
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell,
		Pagination
	} from '$lib/components';
	import { EMPLOYEES, formatSalary, type SortKey, type SortDirection, type Status } from '../_data/mock-data';

	let currentPage = $state(1);
	let pageSize = $state(6);
	let sortKey = $state<SortKey>('name');
	let sortDir = $state<SortDirection>('asc');

	let sorted = $derived.by(() => {
		const key = sortKey;
		const dir = sortDir === 'asc' ? 1 : -1;
		return [...EMPLOYEES].sort((a, b) => {
			const av = a[key];
			const bv = b[key];
			if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
			return String(av).localeCompare(String(bv)) * dir;
		});
	});

	let totalPages = $derived(Math.ceil(sorted.length / pageSize));
	let paginated = $derived(sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize));
	let rangeStart = $derived((currentPage - 1) * pageSize + 1);
	let rangeEnd = $derived(Math.min(currentPage * pageSize, sorted.length));

	$effect(() => {
		pageSize; // track
		currentPage = 1;
	});

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	function statusColor(status: Status): string {
		if (status === 'active') return 'var(--color-success)';
		if (status === 'on-leave') return 'var(--color-warning)';
		return 'var(--color-error)';
	}

	const columns: { key: SortKey; label: string; align?: 'right'; mono?: boolean }[] = [
		{ key: 'name', label: 'Name' },
		{ key: 'role', label: 'Role' },
		{ key: 'department', label: 'Department' },
		{ key: 'salary', label: 'Salary', align: 'right', mono: true },
		{ key: 'rating', label: 'Rating', align: 'right' },
		{ key: 'projects', label: 'Projects', align: 'right' },
		{ key: 'status', label: 'Status' }
	];
</script>

<section id="tbl-observatory" class="section">
	<h2 class="section-title">Observatory</h2>
	<p class="section-description">Dark dashboard control panel with pagination and sortable columns. Page size is adjustable.</p>

	<div class="demos">
		<div class="observatory-wrapper">
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
						{#each paginated as emp (emp.id)}
							<TableRow>
								<TableCell class="font-medium">{emp.name}</TableCell>
								<TableCell>{emp.role}</TableCell>
								<TableCell>{emp.department}</TableCell>
								<TableCell class="text-right tabular-nums">{formatSalary(emp.salary)}</TableCell>
								<TableCell class="text-right tabular-nums">{emp.rating}</TableCell>
								<TableCell class="text-right tabular-nums">{emp.projects}</TableCell>
								<TableCell>
									<span class="status-dot">
										<span class="status-indicator" style="background:{statusColor(emp.status)}"></span>
										<span class="status-label">{emp.status}</span>
									</span>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>

			<div class="observatory-footer">
				<span class="showing-text">
					Showing {rangeStart}–{rangeEnd} of {sorted.length}
				</span>

				<Pagination
					{currentPage}
					{totalPages}
					onPageChange={(p) => currentPage = p}
					maxPages={5}
				/>

				<select
					class="page-size-select"
					bind:value={pageSize}
					aria-label="Rows per page"
				>
					<option value={4}>4 / page</option>
					<option value={6}>6 / page</option>
					<option value={8}>8 / page</option>
					<option value={12}>12 / page</option>
				</select>
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

	.observatory-wrapper {
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		--color-bg: #0f1117;
		--color-fg: #e4e7ec;
		--color-muted: #8b8fa3;
		--color-border: #2a2d3a;
		--color-subtle: #1a1d28;
		--surface-1: #14161f;
		background: var(--color-bg);
		color: var(--color-fg);
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

	.sort-btn.active {
		color: var(--color-primary);
	}

	.status-dot {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-label {
		font-size: var(--text-fluid-sm);
	}

	.observatory-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.showing-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		white-space: nowrap;
	}

	.page-size-select {
		padding: var(--spacing-1) var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.page-size-select:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}
</style>
