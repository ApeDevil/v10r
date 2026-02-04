<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell,
		Pagination
	} from '$lib/components';

	let currentPage = $state(1);
	const totalPages = 10;

	const sampleData = [
		{ id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
		{ id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'User' },
		{ id: '3', name: 'Carol Williams', email: 'carol@example.com', role: 'Editor' }
	];
</script>

<section id="data" class="section">
	<h2 class="section-title">Data</h2>
	<p class="section-description">Components for displaying tabular data.</p>

	<div class="demos">
		<!-- Table -->
		<DemoCard title="Table" description="Data table with headers">
			<div class="table-container">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHeaderCell>Name</TableHeaderCell>
							<TableHeaderCell>Email</TableHeaderCell>
							<TableHeaderCell>Role</TableHeaderCell>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each sampleData as user}
							<TableRow>
								<TableCell>{user.name}</TableCell>
								<TableCell>{user.email}</TableCell>
								<TableCell>{user.role}</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</DemoCard>

		<!-- Pagination -->
		<DemoCard title="Pagination" description="Page navigation">
			<div class="pagination-demo">
				<Pagination
					{currentPage}
					{totalPages}
					onPageChange={(page) => (currentPage = page)}
				/>
				<p class="page-info">Current page: {currentPage} of {totalPages}</p>
			</div>
		</DemoCard>
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

	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.pagination-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-4);
		width: 100%;
	}

	.page-info {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
