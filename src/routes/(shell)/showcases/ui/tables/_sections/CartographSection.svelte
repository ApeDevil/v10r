<script lang="ts">
import {
	Badge,
	Pagination,
	Table,
	Body as TableBody,
	Cell as TableCell,
	Header as TableHeader,
	HeaderCell as TableHeaderCell,
	Row as TableRow,
} from '$lib/components';
import { Input, Select } from '$lib/components/primitives';
import {
	DEPARTMENTS,
	type Department,
	EMPLOYEES,
	formatDate,
	formatSalary,
	type SortDirection,
	type SortKey,
	type Status,
} from '../_data/mock-data';

let search = $state('');
let departmentFilter = $state<Department | ''>('');
let sortKey = $state<SortKey>('name');
let sortDir = $state<SortDirection>('asc');
let currentPage = $state(1);
let pageSize = $state(6);
let selected = $state<Set<string>>(new Set());
let headerCheckbox = $state<HTMLInputElement | null>(null);

// Filter → Sort → Paginate pipeline
let filtered = $derived.by(() => {
	let result = EMPLOYEES;
	if (departmentFilter) {
		result = result.filter((e) => e.department === departmentFilter);
	}
	if (search) {
		const q = search.toLowerCase();
		result = result.filter(
			(e) =>
				e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.department.toLowerCase().includes(q),
		);
	}
	return result;
});

let sorted = $derived.by(() => {
	const key = sortKey;
	const dir = sortDir === 'asc' ? 1 : -1;
	return [...filtered].sort((a, b) => {
		const av = a[key];
		const bv = b[key];
		if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
		return String(av).localeCompare(String(bv)) * dir;
	});
});

let totalPages = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
let paginated = $derived(sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize));
let rangeStart = $derived(sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1);
let rangeEnd = $derived(Math.min(currentPage * pageSize, sorted.length));

// Reset page on filter/sort/pageSize change
$effect(() => {
	search;
	departmentFilter;
	sortKey;
	sortDir;
	pageSize;
	currentPage = 1;
});

// Selection scoped to current page
let pageIds = $derived(new Set(paginated.map((e) => e.id)));
let allPageSelected = $derived(paginated.length > 0 && paginated.every((e) => selected.has(e.id)));
let somePageSelected = $derived(paginated.some((e) => selected.has(e.id)) && !allPageSelected);

$effect(() => {
	if (headerCheckbox) {
		headerCheckbox.indeterminate = somePageSelected;
	}
});

function toggleAll() {
	const next = new Set(selected);
	if (allPageSelected || somePageSelected) {
		for (const id of pageIds) next.delete(id);
	} else {
		for (const id of pageIds) next.add(id);
	}
	selected = next;
}

function toggleRow(id: string) {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	selected = next;
}

function toggleSort(key: SortKey) {
	if (sortKey === key) {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	} else {
		sortKey = key;
		sortDir = 'asc';
	}
}

function statusVariant(status: Status) {
	if (status === 'active') return 'success' as const;
	if (status === 'on-leave') return 'warning' as const;
	return 'error' as const;
}

const columns: { key: SortKey; label: string; align?: 'right' }[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'email', label: 'Email' },
	{ key: 'department', label: 'Department' },
	{ key: 'salary', label: 'Salary', align: 'right' },
	{ key: 'status', label: 'Status' },
	{ key: 'startDate', label: 'Start Date' },
];
</script>

<section id="tbl-cartograph" class="section">
	<h2 class="section-title">Cartograph</h2>
	<p class="section-description">Surveyor's grid combining sorting, filtering, pagination, and row selection. The full interactive data table experience.</p>

	<div class="demos">
		<div class="cartograph-frame">
			<div class="cartograph-main">
				<div class="cartograph-controls">
					<Input
						class="flex-1 min-w-[150px]"
						placeholder="Search..."
						bind:value={search}
						aria-label="Search employees"
					/>
					<Select
						options={[
							{ value: '', label: 'All departments' },
							...DEPARTMENTS.map((d) => ({ value: d, label: d })),
						]}
						bind:value={departmentFilter}
						placeholder="All departments"
					/>
					{#if selected.size > 0}
						<span class="carto-selection-count">{selected.size} selected</span>
					{/if}
				</div>

				<div class="table-container">
					<Table>
						<TableHeader>
							<TableRow hoverable={false}>
								<TableHeaderCell class="w-12">
									<input
										type="checkbox"
										bind:this={headerCheckbox}
										checked={allPageSelected}
										aria-checked={somePageSelected ? 'mixed' : allPageSelected}
										aria-label="Select all on this page"
										onchange={toggleAll}
										class="row-checkbox"
									/>
								</TableHeaderCell>
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
													<span class="i-lucide-chevron-up sort-icon" ></span>
												{:else}
													<span class="i-lucide-chevron-down sort-icon" ></span>
												{/if}
											{:else}
												<span class="i-lucide-chevrons-up-down sort-icon idle" ></span>
											{/if}
										</button>
									</TableHeaderCell>
								{/each}
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each paginated as emp (emp.id)}
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
									<TableCell class="text-muted">{emp.email}</TableCell>
									<TableCell>{emp.department}</TableCell>
									<TableCell class="text-right tabular-nums">{formatSalary(emp.salary)}</TableCell>
									<TableCell>
										<Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
									</TableCell>
									<TableCell>{formatDate(emp.startDate)}</TableCell>
								</TableRow>
							{/each}
							{#if paginated.length === 0}
								<TableRow hoverable={false}>
									<TableCell class="empty-state" colspan={7}>
										No matching records found.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>

				<div class="cartograph-footer">
					<span class="showing-text">
						{#if sorted.length > 0}
							Showing {rangeStart}–{rangeEnd} of {sorted.length}
						{:else}
							No results
						{/if}
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

	.cartograph-frame {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.cartograph-main {
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.cartograph-controls {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		align-items: center;
	}

	.carto-selection-count {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-primary);
		white-space: nowrap;
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

	.row-checkbox {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: var(--color-primary);
	}

	:global(.row-selected) {
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
	}

	:global(.empty-state) {
		text-align: center;
		color: var(--color-muted);
		font-style: italic;
	}

	.cartograph-footer {
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
