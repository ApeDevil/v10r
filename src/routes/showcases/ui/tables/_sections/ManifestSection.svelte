<script lang="ts">
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell,
		Badge,
		TickMarks,
		GeometricMark,
		Divider
	} from '$lib/components';
	import { EMPLOYEES, DEPARTMENTS, type Department, type Status } from '../_data/mock-data';

	let search = $state('');
	let departmentFilter = $state<Department | ''>('');

	let filtered = $derived.by(() => {
		let result = EMPLOYEES;
		if (departmentFilter) {
			result = result.filter(e => e.department === departmentFilter);
		}
		if (search) {
			const q = search.toLowerCase();
			result = result.filter(e =>
				e.name.toLowerCase().includes(q) ||
				e.email.toLowerCase().includes(q) ||
				e.role.toLowerCase().includes(q) ||
				e.location.toLowerCase().includes(q)
			);
		}
		return result;
	});

	function statusVariant(status: Status) {
		if (status === 'active') return 'success' as const;
		if (status === 'on-leave') return 'warning' as const;
		return 'error' as const;
	}
</script>

<section id="tbl-manifest" class="section">
	<h2 class="section-title">
		<GeometricMark shape="diamond" size={12} class="inline-block mr-2 align-middle" />
		Manifest
	</h2>
	<p class="section-description">Expedition log with text search and department filtering. Results update live as you type.</p>

	<div class="demos">
		<div class="manifest-layout">
			<div class="manifest-ticks">
				<TickMarks orientation="vertical" count={15} majorEvery={5} />
			</div>

			<div class="manifest-main">
				<div class="manifest-controls">
					<input
						type="search"
						class="manifest-search"
						placeholder="Search name, email, role, location..."
						bind:value={search}
						aria-label="Search employees"
					/>
					<select
						class="manifest-select"
						bind:value={departmentFilter}
						aria-label="Filter by department"
					>
						<option value="">All departments</option>
						{#each DEPARTMENTS as dept}
							<option value={dept}>{dept}</option>
						{/each}
					</select>
				</div>

				<Divider motif="crosshair" />

				<p class="result-count" aria-live="polite">
					{filtered.length} {filtered.length === 1 ? 'record' : 'records'} found
				</p>

				<div class="table-container">
					<Table>
						<TableHeader>
							<TableRow hoverable={false}>
								<TableHeaderCell>Name</TableHeaderCell>
								<TableHeaderCell>Email</TableHeaderCell>
								<TableHeaderCell>Department</TableHeaderCell>
								<TableHeaderCell>Role</TableHeaderCell>
								<TableHeaderCell>Status</TableHeaderCell>
								<TableHeaderCell>Location</TableHeaderCell>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#each filtered as emp (emp.id)}
								<TableRow>
									<TableCell class="font-medium">{emp.name}</TableCell>
									<TableCell class="text-muted">{emp.email}</TableCell>
									<TableCell>{emp.department}</TableCell>
									<TableCell>{emp.role}</TableCell>
									<TableCell>
										<Badge variant={statusVariant(emp.status)}>{emp.status}</Badge>
									</TableCell>
									<TableCell>{emp.location}</TableCell>
								</TableRow>
							{/each}
							{#if filtered.length === 0}
								<TableRow hoverable={false}>
									<TableCell class="empty-state" colspan={6}>
										No matching records found.
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</div>
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

	.manifest-layout {
		display: flex;
		gap: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-6);
	}

	.manifest-ticks {
		display: none;
		flex-shrink: 0;
		padding-top: var(--spacing-4);
	}

	@media (min-width: 768px) {
		.manifest-ticks {
			display: block;
		}
	}

	.manifest-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.manifest-controls {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.manifest-search {
		flex: 1;
		min-width: 200px;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.manifest-search::placeholder {
		color: var(--color-muted);
	}

	.manifest-search:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}

	.manifest-select {
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.manifest-select:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}

	.result-count {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	:global(.empty-state) {
		text-align: center;
		color: var(--color-muted);
		font-style: italic;
	}
</style>
