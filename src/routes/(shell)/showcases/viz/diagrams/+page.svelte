<script lang="ts">
import type { Edge, Node } from '@xyflow/svelte';
import { BackLink, NavSection, PageHeader } from '$lib/components/composites';
import { Body, Cell, Header, HeaderCell, Row, Table } from '$lib/components/primitives/table';
import { FlowDiagram, StateDiagram } from '$lib/components/viz';
import VizDemoCard from '../_components/VizDemoCard.svelte';

const sections = [
	{ id: 'auth-flow', label: 'Auth Flow' },
	{ id: 'order-state', label: 'Order State' },
	{ id: 'cicd-pipeline', label: 'CI/CD' },
];

// --- Section 1: Authentication Flow (FlowDiagram) ---
const authNodes: Node[] = [
	{ id: 'start', type: 'flow', position: { x: 250, y: 0 }, data: { label: 'Start', variant: 'terminal' } },
	{ id: 'login', type: 'flow', position: { x: 250, y: 100 }, data: { label: 'Login Page' } },
	{ id: 'validate', type: 'flow', position: { x: 250, y: 200 }, data: { label: 'Valid?', variant: 'decision' } },
	{ id: 'dashboard', type: 'flow', position: { x: 100, y: 340 }, data: { label: 'Dashboard' } },
	{ id: 'error', type: 'flow', position: { x: 400, y: 340 }, data: { label: 'Error' } },
	{ id: 'retry', type: 'flow', position: { x: 400, y: 440 }, data: { label: 'Retry', variant: 'terminal' } },
];

const authEdges: Edge[] = [
	{ id: 'e-start-login', source: 'start', target: 'login', type: 'smoothstep' },
	{ id: 'e-login-validate', source: 'login', target: 'validate', type: 'smoothstep' },
	{ id: 'e-validate-dashboard', source: 'validate', target: 'dashboard', type: 'smoothstep', label: 'Yes' },
	{ id: 'e-validate-error', source: 'validate', target: 'error', type: 'smoothstep', label: 'No' },
	{ id: 'e-error-retry', source: 'error', target: 'retry', type: 'smoothstep' },
	{ id: 'e-retry-login', source: 'retry', target: 'login', type: 'smoothstep', animated: true },
];

// --- Section 2: Order State Machine (StateDiagram) ---
const orderNodes: Node[] = [
	{ id: 'start', type: 'start', position: { x: 0, y: 150 }, data: { variant: 'start' } },
	{ id: 'pending', type: 'state', position: { x: 100, y: 140 }, data: { label: 'Pending', variant: 'state' } },
	{ id: 'processing', type: 'state', position: { x: 280, y: 140 }, data: { label: 'Processing', variant: 'state' } },
	{ id: 'shipped', type: 'state', position: { x: 460, y: 140 }, data: { label: 'Shipped', variant: 'state' } },
	{ id: 'delivered', type: 'state', position: { x: 640, y: 140 }, data: { label: 'Delivered', variant: 'state' } },
	{ id: 'end', type: 'end', position: { x: 800, y: 150 }, data: { variant: 'end' } },
	{ id: 'failed', type: 'state', position: { x: 280, y: 280 }, data: { label: 'Failed', variant: 'state' } },
];

const orderEdges: Edge[] = [
	{ id: 'e-start-pending', source: 'start', target: 'pending', type: 'smoothstep', label: 'place' },
	{ id: 'e-pending-processing', source: 'pending', target: 'processing', type: 'smoothstep', label: 'confirm' },
	{ id: 'e-processing-shipped', source: 'processing', target: 'shipped', type: 'smoothstep', label: 'ship' },
	{ id: 'e-shipped-delivered', source: 'shipped', target: 'delivered', type: 'smoothstep', label: 'deliver' },
	{ id: 'e-delivered-end', source: 'delivered', target: 'end', type: 'smoothstep' },
	{ id: 'e-processing-failed', source: 'processing', target: 'failed', type: 'smoothstep', label: 'error' },
	{ id: 'e-failed-pending', source: 'failed', target: 'pending', type: 'smoothstep', label: 'retry', animated: true },
];

// --- Section 3: CI/CD Pipeline (FlowDiagram) ---
const cicdNodes: Node[] = [
	{ id: 'build', type: 'flow', position: { x: 0, y: 150 }, data: { label: 'Build' } },
	{ id: 'test-unit', type: 'flow', position: { x: 200, y: 80 }, data: { label: 'Unit Tests' } },
	{ id: 'test-e2e', type: 'flow', position: { x: 200, y: 220 }, data: { label: 'E2E Tests' } },
	{ id: 'deploy-staging', type: 'flow', position: { x: 420, y: 150 }, data: { label: 'Deploy Staging' } },
	{
		id: 'deploy-prod',
		type: 'flow',
		position: { x: 620, y: 150 },
		data: { label: 'Deploy Prod', variant: 'terminal' },
	},
];

const cicdEdges: Edge[] = [
	{ id: 'e-build-unit', source: 'build', target: 'test-unit', type: 'smoothstep' },
	{ id: 'e-build-e2e', source: 'build', target: 'test-e2e', type: 'smoothstep' },
	{ id: 'e-unit-staging', source: 'test-unit', target: 'deploy-staging', type: 'smoothstep' },
	{ id: 'e-e2e-staging', source: 'test-e2e', target: 'deploy-staging', type: 'smoothstep' },
	{ id: 'e-staging-prod', source: 'deploy-staging', target: 'deploy-prod', type: 'smoothstep' },
];
</script>
<div class="page">
	<PageHeader
		title="Diagrams"
		description="Interactive flow diagrams and state machines powered by Svelte Flow. Custom themed nodes, edge labels, and zoom/pan controls."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz', href: '/showcases/viz' },
			{ label: 'Diagrams' }
		]}
	/>

	<NavSection {sections} />

	<main class="content">
		<!-- Authentication Flow -->
		<section id="auth-flow" class="section">
			<h2 class="section-title">Authentication Flow</h2>
			<p class="section-description">A login flow with branching logic. Decision nodes for validation, terminal nodes for start/end, and animated retry edges.</p>

			<div class="demos">
				<VizDemoCard
					title="Auth Flow"
					description="User authentication with validation branching. Animated edge shows retry path."
				>
					{#snippet visualization()}
						<FlowDiagram
							nodes={authNodes}
							edges={authEdges}
							ariaLabel="Authentication flow diagram"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Step</HeaderCell>
									<HeaderCell>Type</HeaderCell>
									<HeaderCell>Connects To</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each authNodes as node}
									<Row>
										<Cell>{node.data.label}</Cell>
										<Cell>{node.data.variant ?? 'default'}</Cell>
										<Cell>
											{authEdges
												.filter((e) => e.source === node.id)
												.map((e) => {
													const target = authNodes.find((n) => n.id === e.target);
													return target?.data.label ?? e.target;
												})
												.join(', ') || '\u2014'}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<FlowDiagram
  nodes={[
    { id: 'start', type: 'flow', position: { x: 250, y: 0 },
      data: { label: 'Start', variant: 'terminal' } },
    { id: 'login', type: 'flow', position: { x: 250, y: 100 },
      data: { label: 'Login Page' } },
    { id: 'validate', type: 'flow', position: { x: 250, y: 200 },
      data: { label: 'Valid?', variant: 'decision' } },
    // ...
  ]}
  edges={[
    { id: 'e1', source: 'start', target: 'login', type: 'smoothstep' },
    { id: 'e2', source: 'validate', target: 'dashboard',
      type: 'smoothstep', label: 'Yes' },
    // ...
  ]}
  ariaLabel="Authentication flow"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Order State Machine -->
		<section id="order-state" class="section">
			<h2 class="section-title">Order State Machine</h2>
			<p class="section-description">State diagram showing order lifecycle transitions. Read-only visualization with labeled edges for transition events.</p>

			<div class="demos">
				<VizDemoCard
					title="Order Lifecycle"
					description="States from order placement through delivery. Error branch shows retry path with animated transition."
				>
					{#snippet visualization()}
						<StateDiagram
							nodes={orderNodes}
							edges={orderEdges}
							ariaLabel="Order state machine diagram"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>From</HeaderCell>
									<HeaderCell>Event</HeaderCell>
									<HeaderCell>To</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each orderEdges.filter((e) => e.label) as edge}
									<Row>
										<Cell>
											{orderNodes.find((n) => n.id === edge.source)?.data.label ?? edge.source}
										</Cell>
										<Cell>{edge.label}</Cell>
										<Cell>
											{orderNodes.find((n) => n.id === edge.target)?.data.label ?? edge.target}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<StateDiagram
  nodes={[
    { id: 'start', type: 'start', position: { x: 0, y: 150 },
      data: { variant: 'start' } },
    { id: 'pending', type: 'state', position: { x: 100, y: 140 },
      data: { label: 'Pending', variant: 'state' } },
    // ...
  ]}
  edges={[
    { id: 'e1', source: 'start', target: 'pending',
      type: 'smoothstep', label: 'place' },
    { id: 'e2', source: 'pending', target: 'processing',
      type: 'smoothstep', label: 'confirm' },
    // ...
  ]}
  ariaLabel="Order state machine"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- CI/CD Pipeline -->
		<section id="cicd-pipeline" class="section">
			<h2 class="section-title">CI/CD Pipeline</h2>
			<p class="section-description">Build pipeline with parallel test paths converging before deployment. Shows how FlowDiagram handles fan-out and fan-in patterns.</p>

			<div class="demos">
				<VizDemoCard
					title="Pipeline"
					description="Build triggers parallel unit and E2E tests, both must pass before staging and production deploys."
				>
					{#snippet visualization()}
						<FlowDiagram
							nodes={cicdNodes}
							edges={cicdEdges}
							ariaLabel="CI/CD pipeline diagram"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Stage</HeaderCell>
									<HeaderCell>Depends On</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each cicdNodes as node}
									<Row>
										<Cell>{node.data.label}</Cell>
										<Cell>
											{cicdEdges
												.filter((e) => e.target === node.id)
												.map((e) => cicdNodes.find((n) => n.id === e.source)?.data.label ?? e.source)
												.join(', ') || '\u2014'}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<FlowDiagram
  nodes={[
    { id: 'build', type: 'flow', position: { x: 0, y: 150 },
      data: { label: 'Build' } },
    { id: 'test-unit', type: 'flow', position: { x: 200, y: 80 },
      data: { label: 'Unit Tests' } },
    { id: 'test-e2e', type: 'flow', position: { x: 200, y: 220 },
      data: { label: 'E2E Tests' } },
    // ...
  ]}
  edges={[
    { id: 'e1', source: 'build', target: 'test-unit', type: 'smoothstep' },
    { id: 'e2', source: 'build', target: 'test-e2e', type: 'smoothstep' },
    // ...
  ]}
  ariaLabel="CI/CD pipeline"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>
	</main>

	<BackLink href="/showcases/viz" label="Viz" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}


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

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
