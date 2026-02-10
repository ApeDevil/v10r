<script lang="ts">
	import { DemoCard, VariantGrid } from '../_components';
	import {
		Table,
		Header as TableHeader,
		Body as TableBody,
		Row as TableRow,
		HeaderCell as TableHeaderCell,
		Cell as TableCell,
		Badge,
		Chip,
		FilterChip,
		Avatar,
		Skeleton,
		SkeletonText,
		SkeletonCard,
		SkeletonAvatar,
		Kbd,
		Progress,
		Spinner
	} from '$lib/components';

	const sampleData = [
		{ id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
		{ id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'User' },
		{ id: '3', name: 'Carol Williams', email: 'carol@example.com', role: 'Editor' }
	];

	let progressValue = $state(65);

	let chips = $state(['Svelte', 'TypeScript', 'UnoCSS', 'Bits UI']);
	let filterActive = $state(false);
	let filterPending = $state(true);
	let filterCompleted = $state(false);
</script>

<section id="prim-data-display" class="section">
	<h2 class="section-title">Data Display</h2>
	<p class="section-description">Components for presenting data and status information.</p>

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

		<!-- Badge Variants -->
		<DemoCard title="Badge Variants" description="Status indicators">
			<VariantGrid layout="row">
				<Badge variant="default">Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="success">Success</Badge>
				<Badge variant="warning">Warning</Badge>
				<Badge variant="error">Error</Badge>
				<Badge variant="outline">Outline</Badge>
			</VariantGrid>
		</DemoCard>

		<!-- Chips -->
		<DemoCard title="Chip" description="Dismissible tags and toggle-based filters">
			<div class="chip-demos">
				<div class="chip-group">
					<span class="chip-group-label">Variants</span>
					<VariantGrid layout="row">
						<Chip label="Default" variant="default" ondismiss={() => {}} />
						<Chip label="Secondary" variant="secondary" ondismiss={() => {}} />
						<Chip label="Success" variant="success" ondismiss={() => {}} />
						<Chip label="Warning" variant="warning" ondismiss={() => {}} />
						<Chip label="Error" variant="error" ondismiss={() => {}} />
						<Chip label="Outline" variant="outline" ondismiss={() => {}} />
					</VariantGrid>
				</div>

				<hr class="chip-divider" />

				<div class="chip-group">
					<span class="chip-group-label">Sizes & options</span>
					<VariantGrid layout="row">
						<Chip label="Small" size="sm" ondismiss={() => {}} />
						<Chip label="Medium" size="md" ondismiss={() => {}} />
						<Chip label="With Icon" size="md" icon="i-lucide-tag" ondismiss={() => {}} />
						<Chip label="No dismiss" variant="secondary" />
					</VariantGrid>
				</div>

				<hr class="chip-divider" />

				<div class="chip-group">
					<span class="chip-group-label">Interactive — click x to remove</span>
					<VariantGrid layout="row">
						{#each chips as chip (chip)}
							<Chip
								label={chip}
								variant="secondary"
								ondismiss={() => { chips = chips.filter(c => c !== chip); }}
							/>
						{/each}
						{#if chips.length === 0}
							<span class="chips-empty">All chips removed</span>
						{/if}
					</VariantGrid>
				</div>

				<hr class="chip-divider" />

				<div class="chip-group">
					<span class="chip-group-label">Filter (toggle)</span>
					<VariantGrid layout="row">
						<FilterChip label="Active" bind:pressed={filterActive} />
						<FilterChip label="Pending" bind:pressed={filterPending} />
						<FilterChip label="Completed" bind:pressed={filterCompleted} />
					</VariantGrid>
				</div>

				<hr class="chip-divider" />

				<div class="chip-group">
					<span class="chip-group-label">Filter variants</span>
					<VariantGrid layout="row">
						<FilterChip label="Default" variant="default" bind:pressed={filterActive} />
						<FilterChip label="Outline" variant="outline" bind:pressed={filterPending} />
						<FilterChip label="With Icon" variant="default" icon="i-lucide-star" bind:pressed={filterCompleted} />
						<FilterChip label="Disabled" variant="default" disabled />
					</VariantGrid>
				</div>
			</div>
		</DemoCard>

		<!-- Avatar -->
		<DemoCard title="Avatar" description="User profile images with fallback">
			<VariantGrid layout="row">
				<Avatar size="sm" fallback="AB" />
				<Avatar size="md" fallback="CD" />
				<Avatar size="lg" fallback="EF" />
			</VariantGrid>
		</DemoCard>

		<!-- Kbd -->
		<DemoCard title="Keyboard Shortcut" description="Keyboard key indicators">
			<VariantGrid layout="row">
				<Kbd keys="Ctrl+C" />
				<Kbd keys="Ctrl+V" />
				<Kbd keys={['Cmd', 'Shift', 'P']} />
				<Kbd keys="Esc" size="sm" />
				<Kbd keys="Enter" size="lg" />
			</VariantGrid>
		</DemoCard>

		<!-- Progress -->
		<DemoCard title="Progress" description="Progress indicator bar">
			<div class="progress-demos">
				<div class="progress-row">
					<span class="progress-label">Default</span>
					<Progress value={progressValue} />
				</div>
				<div class="progress-row">
					<span class="progress-label">With label</span>
					<Progress value={progressValue} showLabel />
				</div>
				<div class="progress-row">
					<span class="progress-label">Success</span>
					<Progress value={100} variant="success" showLabel />
				</div>
				<div class="progress-row">
					<span class="progress-label">Indeterminate</span>
					<Progress />
				</div>
			</div>
		</DemoCard>

		<!-- Spinner -->
		<DemoCard title="Spinner" description="Loading indicator">
			<VariantGrid layout="row">
				<Spinner size="sm" />
				<Spinner size="md" />
				<Spinner size="lg" />
				<Spinner variant="muted" />
			</VariantGrid>
		</DemoCard>

		<!-- Skeleton -->
		<DemoCard title="Skeleton" description="Loading placeholders">
			<div class="skeleton-demo">
				<SkeletonCard />
				<div class="skeleton-text-demo">
					<SkeletonAvatar />
					<div class="skeleton-text-group">
						<SkeletonText width="60%" />
						<SkeletonText width="40%" />
					</div>
				</div>
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

	.progress-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.progress-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.progress-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.skeleton-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
		max-width: 25rem;
	}

	.skeleton-text-demo {
		display: flex;
		gap: var(--spacing-4);
		align-items: center;
	}

	.skeleton-text-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.chip-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.chip-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.chip-group-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.chip-divider {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 0;
	}

	.chips-empty {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-style: italic;
	}
</style>
