<script lang="ts">
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell,
		Flourish,
		Kamon,
		Divider
	} from '$lib/components';
	import { EMPLOYEES, DEPARTMENTS, formatSalary, formatDate, type Department } from '../_data/mock-data';

	let expandedGroups = $state<Set<Department>>(new Set(DEPARTMENTS));

	let grouped = $derived.by(() => {
		const map = new Map<Department, typeof EMPLOYEES>();
		for (const dept of DEPARTMENTS) {
			const members = EMPLOYEES.filter(e => e.department === dept);
			if (members.length > 0) {
				map.set(dept, members);
			}
		}
		return map;
	});

	function toggleGroup(dept: Department) {
		const next = new Set(expandedGroups);
		if (next.has(dept)) {
			next.delete(dept);
		} else {
			next.add(dept);
		}
		expandedGroups = next;
	}

	function expandAll() {
		expandedGroups = new Set(DEPARTMENTS);
	}

	function collapseAll() {
		expandedGroups = new Set();
	}

	function avgSalary(employees: typeof EMPLOYEES): string {
		const avg = employees.reduce((sum, e) => sum + e.salary, 0) / employees.length;
		return formatSalary(Math.round(avg));
	}
</script>

<section id="tbl-folio" class="section">
	<h2 class="section-title">
		<Kamon folds={6} size={32} class="inline-block mr-2 align-middle" />
		Folio
	</h2>
	<p class="section-description">Annual report with rows grouped by department. Groups are collapsible with expand/collapse-all controls.</p>

	<div class="demos">
		<div class="folio-frame">
			<Flourish position="top-left" size={48} />
			<Flourish position="bottom-right" size={48} />

			<div class="folio-controls">
				<button class="folio-btn" onclick={expandAll}>Expand all</button>
				<button class="folio-btn" onclick={collapseAll}>Collapse all</button>
			</div>

			<div class="table-container">
				<Table>
					<TableHeader>
						<TableRow hoverable={false}>
							<TableHeaderCell class="w-10"></TableHeaderCell>
							<TableHeaderCell>Name</TableHeaderCell>
							<TableHeaderCell>Role</TableHeaderCell>
							<TableHeaderCell class="text-right">Salary</TableHeaderCell>
							<TableHeaderCell>Start Date</TableHeaderCell>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each [...grouped] as [dept, members], groupIdx (dept)}
							{#if groupIdx > 0}
								<TableRow hoverable={false}>
									<TableCell colspan={5}>
										<Divider motif="flourish" width="content" />
									</TableCell>
								</TableRow>
							{/if}

							<TableRow hoverable={false}>
								<TableCell colspan={5}>
									<button
										class="group-header"
										onclick={() => toggleGroup(dept)}
										aria-expanded={expandedGroups.has(dept)}
									>
										<span class="chevron" class:expanded={expandedGroups.has(dept)}>
											<span class="i-lucide-chevron-right" />
										</span>
										<span class="group-name">{dept}</span>
										<span class="group-meta">
											{members.length} {members.length === 1 ? 'member' : 'members'} · avg {avgSalary(members)}
										</span>
									</button>
								</TableCell>
							</TableRow>

							{#if expandedGroups.has(dept)}
								{#each members as emp (emp.id)}
									<TableRow>
										<TableCell></TableCell>
										<TableCell class="font-medium">{emp.name}</TableCell>
										<TableCell>{emp.role}</TableCell>
										<TableCell class="text-right tabular-nums">{formatSalary(emp.salary)}</TableCell>
										<TableCell>{formatDate(emp.startDate)}</TableCell>
									</TableRow>
								{/each}
							{/if}
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

	.folio-frame {
		position: relative;
		padding: var(--spacing-7);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.folio-controls {
		display: flex;
		gap: var(--spacing-3);
	}

	.folio-btn {
		padding: var(--spacing-1) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: color var(--duration-fast), border-color var(--duration-fast);
	}

	.folio-btn:hover {
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	.folio-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		width: 100%;
		background: none;
		border: none;
		padding: var(--spacing-1) 0;
		font: inherit;
		cursor: pointer;
		color: var(--color-fg);
	}

	.group-header:hover {
		color: var(--color-primary);
	}

	.group-header:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.chevron {
		display: inline-flex;
		transition: transform var(--duration-fast);
	}

	.chevron.expanded {
		transform: rotate(90deg);
	}

	.group-name {
		font-weight: 700;
		font-size: var(--text-fluid-base);
	}

	.group-meta {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 400;
	}
</style>
