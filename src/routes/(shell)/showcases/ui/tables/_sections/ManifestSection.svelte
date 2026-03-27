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
import { Input, Select } from '$lib/components/primitives';
import { DEPARTMENTS, type Department, EMPLOYEES, type Status } from '../_data/mock-data';

let search = $state('');
let departmentFilter = $state<Department | ''>('');

let filtered = $derived.by(() => {
	let result = EMPLOYEES;
	if (departmentFilter) {
		result = result.filter((e) => e.department === departmentFilter);
	}
	if (search) {
		const q = search.toLowerCase();
		result = result.filter(
			(e) =>
				e.name.toLowerCase().includes(q) ||
				e.email.toLowerCase().includes(q) ||
				e.role.toLowerCase().includes(q) ||
				e.location.toLowerCase().includes(q),
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
	<h2 class="section-title">Manifest</h2>
	<p class="section-description">Expedition log with text search and department filtering. Results update live as you type.</p>

	<div class="demos">
		<div class="manifest-layout">
			<div class="manifest-main">
				<div class="manifest-controls">
					<Input
						class="flex-1 min-w-[200px]"
						placeholder="Search name, email, role, location..."
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
				</div>

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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-6);
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
