<script lang="ts">
	import {
		Table,
		Header,
		Body,
		Row,
		HeaderCell,
		Cell,
		Tooltip,
		Popover,
		Combobox,
		Button,
		Badge
	} from '$lib/components/primitives';
	import { Pagination, Card, PageHeader } from '$lib/components/composites';

	// Sample data for table
	interface User {
		id: number;
		name: string;
		email: string;
		role: string;
		status: 'active' | 'inactive';
	}

	const users: User[] = [
		{ id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'active' },
		{
			id: 2,
			name: 'Bob Smith',
			email: 'bob@example.com',
			role: 'Editor',
			status: 'active'
		},
		{
			id: 3,
			name: 'Charlie Brown',
			email: 'charlie@example.com',
			role: 'Viewer',
			status: 'inactive'
		},
		{ id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Admin', status: 'active' },
		{
			id: 5,
			name: 'Ethan Hunt',
			email: 'ethan@example.com',
			role: 'Editor',
			status: 'active'
		}
	];

	// Pagination state
	let currentPage = $state(1);
	const totalPages = 5;

	// Combobox state
	let selectedCountry = $state<string>();
	const countries = [
		{ value: 'us', label: 'United States' },
		{ value: 'uk', label: 'United Kingdom' },
		{ value: 'ca', label: 'Canada' },
		{ value: 'au', label: 'Australia' },
		{ value: 'de', label: 'Germany' },
		{ value: 'fr', label: 'France' },
		{ value: 'jp', label: 'Japan' },
		{ value: 'in', label: 'India' }
	];

	function handlePageChange(page: number) {
		currentPage = page;
	}
</script>

<PageHeader
	title="Data Components"
	breadcrumbs={[{ label: 'Showcases', href: '/showcases' }, { label: 'Data' }]}
/>

<div class="space-y-8">
	<!-- Table Section -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Table Component</h2>
			<p class="text-fluid-sm text-muted mt-1">
				Styled table with responsive overflow and hover states
			</p>
		{/snippet}

		<Table>
			<Header>
				<Row>
					<HeaderCell>ID</HeaderCell>
					<HeaderCell>Name</HeaderCell>
					<HeaderCell>Email</HeaderCell>
					<HeaderCell>Role</HeaderCell>
					<HeaderCell>Status</HeaderCell>
				</Row>
			</Header>
			<Body>
				{#each users as user (user.id)}
					<Row>
						<Cell>{user.id}</Cell>
						<Cell class="font-medium">{user.name}</Cell>
						<Cell class="text-muted">{user.email}</Cell>
						<Cell>{user.role}</Cell>
						<Cell>
							<Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
								{user.status}
							</Badge>
						</Cell>
					</Row>
				{/each}
			</Body>
		</Table>
	</Card>

	<!-- Pagination Section -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Pagination Component</h2>
			<p class="text-fluid-sm text-muted mt-1">
				Navigate through pages with keyboard support and ellipsis for many pages
			</p>
		{/snippet}

		<div class="space-y-4">
			<div class="text-center text-fluid-sm text-muted">
				Current page: <span class="font-semibold text-fg">{currentPage}</span> of {totalPages}
			</div>

			<Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />

			<div class="text-center text-fluid-sm text-muted">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => {
						currentPage = 1;
					}}
				>
					Reset to page 1
				</Button>
			</div>
		</div>
	</Card>

	<!-- Tooltip Section -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Tooltip Component</h2>
			<p class="text-fluid-sm text-muted mt-1">
				Show contextual information on hover with customizable positioning
			</p>
		{/snippet}

		<div class="flex flex-wrap gap-4">
			<Tooltip content="This tooltip appears on top" side="top">
				<Button variant="secondary">Hover me (top)</Button>
			</Tooltip>

			<Tooltip content="This tooltip appears on the right" side="right">
				<Button variant="secondary">Hover me (right)</Button>
			</Tooltip>

			<Tooltip content="This tooltip appears on the bottom" side="bottom">
				<Button variant="secondary">Hover me (bottom)</Button>
			</Tooltip>

			<Tooltip content="This tooltip appears on the left" side="left">
				<Button variant="secondary">Hover me (left)</Button>
			</Tooltip>
		</div>
	</Card>

	<!-- Popover Section -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Popover Component</h2>
			<p class="text-fluid-sm text-muted mt-1">
				Display rich content in a floating panel with click-outside-to-close behavior
			</p>
		{/snippet}

		<div class="flex gap-4">
			<Popover>
				{#snippet trigger()}
					<Button variant="secondary">Open Popover</Button>
				{/snippet}

				{#snippet content()}
					<div class="space-y-2">
						<h3 class="font-semibold">Popover Title</h3>
						<p class="text-fluid-sm text-muted">
							This is a popover with rich content. You can include any components inside.
						</p>
						<Button size="sm">Action</Button>
					</div>
				{/snippet}
			</Popover>
		</div>
	</Card>

	<!-- Combobox Section -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Combobox Component</h2>
			<p class="text-fluid-sm text-muted mt-1">
				Searchable select with keyboard navigation and filtering
			</p>
		{/snippet}

		<div class="max-w-md space-y-4">
			<Combobox
				options={countries}
				bind:selected={selectedCountry}
				placeholder="Select a country..."
			/>

			{#if selectedCountry}
				<div class="text-fluid-sm">
					Selected:
					<span class="font-semibold">
						{countries.find((c) => c.value === selectedCountry)?.label}
					</span>
				</div>
			{:else}
				<div class="text-fluid-sm text-muted">No country selected</div>
			{/if}
		</div>
	</Card>

	<!-- Usage Example -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Usage Example</h2>
			<p class="text-fluid-sm text-muted mt-1">Import and use these components in your pages</p>
		{/snippet}

		<div class="space-y-4">
			<div>
				<h3 class="text-fluid-base font-semibold mb-2">Table</h3>
				<pre
					class="bg-muted/10 rounded-md p-4 text-fluid-xs overflow-x-auto"><code>{`import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';

<Table>
  <Header>
    <Row>
      <HeaderCell>Name</HeaderCell>
      <HeaderCell>Email</HeaderCell>
    </Row>
  </Header>
  <Body>
    {#each users as user}
      <Row>
        <Cell>{user.name}</Cell>
        <Cell>{user.email}</Cell>
      </Row>
    {/each}
  </Body>
</Table>`}</code></pre>
			</div>

			<div>
				<h3 class="text-fluid-base font-semibold mb-2">Pagination</h3>
				<pre
					class="bg-muted/10 rounded-md p-4 text-fluid-xs overflow-x-auto"><code>{`import { Pagination } from '$lib/components/composites';

<Pagination
  currentPage={1}
  totalPages={10}
  onPageChange={(page) => handlePageChange(page)}
/>`}</code></pre>
			</div>

			<div>
				<h3 class="text-fluid-base font-semibold mb-2">Tooltip</h3>
				<pre
					class="bg-muted/10 rounded-md p-4 text-fluid-xs overflow-x-auto"><code>{`import { Tooltip, Button } from '$lib/components/primitives';

<Tooltip content="Helpful message" side="top">
  <Button>Hover me</Button>
</Tooltip>`}</code></pre>
			</div>

			<div>
				<h3 class="text-fluid-base font-semibold mb-2">Combobox</h3>
				<pre
					class="bg-muted/10 rounded-md p-4 text-fluid-xs overflow-x-auto"><code>{`import { Combobox } from '$lib/components/primitives';

let selected = $state<string>();

<Combobox
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' }
  ]}
  bind:selected
/>`}</code></pre>
			</div>
		</div>
	</Card>
</div>
