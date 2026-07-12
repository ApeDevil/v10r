<script lang="ts">
import type { Edge, Node } from '@xyflow/svelte';
import {
	BackLink,
	BoundaryFallback,
	Card,
	DiagGrid,
	DiagRow,
	NavSection,
	PageHeader,
} from '$lib/components/composites';
import { Body, Cell, Header, HeaderCell, Row, Table } from '$lib/components/primitives/table';
import { DagGraph, FlowDiagram, StateDiagram } from '$lib/components/viz';
import * as m from '$lib/paraglide/messages';
import { HANDSHAKE_STEPS, TOOL_CARDS } from '$lib/showcase/mcp/tool-cards';
import DemoCard from './_components/DemoCard.svelte';

// Registry data arrives projected from +page.server.ts — the registry JSON
// itself must never enter the client module graph (dev-server fs.allow 403).
let { data } = $props();

const sections = [
	{ id: 'registry-dag', label: 'Dependency Graph' },
	{ id: 'architecture', label: 'Architecture' },
	{ id: 'tools-protocol', label: 'Tools & Protocol' },
];

const stats = $derived(data.stats);
const dagData = $derived(data.dag);

// DagGraph draws only nodes reachable through edges — surface the rest honestly.
const undrawn = $derived.by(() => {
	const connectedIds = new Set(dagData.edges.flatMap((e) => [e.source, e.target]));
	return dagData.nodes.filter((n) => !connectedIds.has(n.id));
});

function dependedBy(id: string): string {
	return (
		data.patterns
			.filter((p) => p.depends_on.includes(id))
			.map((p) => p.id)
			.join(', ') || '—'
	);
}

// --- Architecture: one tool call's journey (FlowDiagram) ---
const archNodes: Node[] = [
	{
		id: 'client',
		type: 'flow',
		position: { x: 250, y: 0 },
		data: { label: 'Claude Code (MCP client)', variant: 'terminal' },
	},
	{ id: 'spawn', type: 'flow', position: { x: 250, y: 100 }, data: { label: 'podman run -i --rm' } },
	{ id: 'container', type: 'flow', position: { x: 250, y: 200 }, data: { label: 'Ephemeral bun container' } },
	{ id: 'server', type: 'flow', position: { x: 250, y: 300 }, data: { label: 'server.ts stdio JSON-RPC loop' } },
	{ id: 'tools', type: 'flow', position: { x: 250, y: 400 }, data: { label: '5 read-only tools' } },
	{ id: 'registry', type: 'flow', position: { x: 80, y: 500 }, data: { label: 'patterns.registry.json' } },
	{ id: 'files', type: 'flow', position: { x: 420, y: 500 }, data: { label: 'Repo file excerpts' } },
	{
		id: 'response',
		type: 'flow',
		position: { x: 250, y: 600 },
		data: { label: 'Text result to client', variant: 'terminal' },
	},
];

const archEdges: Edge[] = [
	{ id: 'e-client-spawn', source: 'client', target: 'spawn', type: 'smoothstep' },
	{ id: 'e-spawn-container', source: 'spawn', target: 'container', type: 'smoothstep', label: 'repo :ro, no network' },
	{ id: 'e-container-server', source: 'container', target: 'server', type: 'smoothstep' },
	{ id: 'e-server-tools', source: 'server', target: 'tools', type: 'smoothstep' },
	{ id: 'e-tools-registry', source: 'tools', target: 'registry', type: 'smoothstep' },
	{ id: 'e-tools-files', source: 'tools', target: 'files', type: 'smoothstep' },
	{ id: 'e-registry-response', source: 'registry', target: 'response', type: 'smoothstep' },
	{ id: 'e-files-response', source: 'files', target: 'response', type: 'smoothstep' },
	{
		id: 'e-response-client',
		source: 'response',
		target: 'client',
		type: 'smoothstep',
		label: 'NDJSON over stdio',
		animated: true,
	},
];

// --- Handshake sequence, as exercised by mcp/smoke.ts (StateDiagram) ---
const handshakeNodes: Node[] = [
	{ id: 'start', type: 'start', position: { x: 0, y: 60 }, data: { variant: 'start' } },
	{ id: 'initialize', type: 'state', position: { x: 100, y: 50 }, data: { label: 'initialize', variant: 'state' } },
	{ id: 'initialized', type: 'state', position: { x: 290, y: 50 }, data: { label: 'initialized', variant: 'state' } },
	{ id: 'tools-list', type: 'state', position: { x: 480, y: 50 }, data: { label: 'tools/list', variant: 'state' } },
	{ id: 'tools-call', type: 'state', position: { x: 660, y: 50 }, data: { label: 'tools/call', variant: 'state' } },
	{ id: 'end', type: 'end', position: { x: 840, y: 60 }, data: { variant: 'end' } },
];

const handshakeEdges: Edge[] = [
	{ id: 'h-start', source: 'start', target: 'initialize', type: 'smoothstep', label: 'spawn' },
	{ id: 'h-init', source: 'initialize', target: 'initialized', type: 'smoothstep', label: 'version + instructions' },
	{ id: 'h-list', source: 'initialized', target: 'tools-list', type: 'smoothstep', label: 'no reply' },
	{ id: 'h-call', source: 'tools-list', target: 'tools-call', type: 'smoothstep', label: '5 tool defs' },
	{ id: 'h-end', source: 'tools-call', target: 'end', type: 'smoothstep', label: 'stdin EOF, exit 0', animated: true },
];
</script>

<div class="page">
	<PageHeader
		title={m.showcase_mcp_title()}
		description={m.showcase_mcp_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_mcp_breadcrumb() }
		]}
	/>

	<NavSection {sections} />

	<svelte:boundary>
	<main class="content">
		<!-- Live registry stats -->
		<div class="stats-grid" role="group" aria-label="Registry statistics">
			<div class="stat-card">
				<span class="stat-value">{stats.patternCount}</span>
				<span class="stat-label">Patterns</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{stats.categoryCount}</span>
				<span class="stat-label">Categories</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{stats.edgeCount}</span>
				<span class="stat-label">Dependency edges</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{stats.invariantCount}</span>
				<span class="stat-label">Invariants</span>
			</div>
		</div>
		<div class="cat-chips" aria-label="Patterns per category">
			{#each stats.categories as category}
				<span class="cat-chip">{category.name} · {category.count}</span>
			{/each}
		</div>
		<p class="lead">
			Every number on this page is computed from <code>mcp/patterns.registry.json</code> — the same file the MCP
			server reads — so the page cannot drift from the registry. Design rationale lives in the
			<a href="/docs/blueprint/architecture/pattern-mcp">blueprint doc</a>; the operational reference is
			<code>mcp/README.md</code>.
		</p>

		<!-- Pattern dependency DAG -->
		<section id="registry-dag" class="section">
			<h2 class="section-title">{m.showcase_mcp_section_dag()}</h2>
			<p class="section-description">
				The registry's <code>depends_on</code> graph. Arrows point dependency → dependent — the topological build
				order <code>recommend_emulation_plan</code> assembles. Node colors mark DAG layers, not categories.
			</p>

			<div class="demos">
				<DemoCard
					title="Registry Dependency DAG"
					description="Live projection of mcp/patterns.registry.json. Emulating a pattern means building its ancestors first."
				>
					{#snippet visualization()}
						<DagGraph data={dagData} ariaLabel="Pattern dependency graph of the MCP registry" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Pattern</HeaderCell>
									<HeaderCell>Category</HeaderCell>
									<HeaderCell>Depends On</HeaderCell>
									<HeaderCell>Depended By</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each data.patterns as pattern}
									<Row>
										<Cell><code>{pattern.id}</code></Cell>
										<Cell>{pattern.category}</Cell>
										<Cell>{pattern.depends_on.join(', ') || '—'}</Cell>
										<Cell>{dependedBy(pattern.id)}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`// $lib/showcase/mcp/registry-viz.ts — fed by a build-time JSON import
const dagData = toDagData(registry);
// nodes: patterns.map((p) => ({ id: p.id, label: SHORT_LABELS[p.id], group: p.category }))
// edges: patterns.flatMap((p) => p.depends_on.map((dep) => ({ source: dep, target: p.id })))

<DagGraph data={dagData} ariaLabel="Pattern dependency graph" />`}</code></pre>
					{/snippet}
				</DemoCard>
				{#if undrawn.length > 0}
					<p class="dag-caption">
						{undrawn.length} of {stats.patternCount} patterns ({undrawn.map((n) => n.id).join(', ')}) have no
						dependency edges and are not drawn above — the Data tab lists every pattern.
					</p>
				{/if}
			</div>
		</section>

		<!-- Ephemeral container architecture -->
		<section id="architecture" class="section">
			<h2 class="section-title">{m.showcase_mcp_section_architecture()}</h2>
			<p class="section-description">
				One tool call's journey. The MCP client spawns the server as an ephemeral container with a read-only repo
				mount and no network; stdout carries protocol frames only, and the container removes itself when the client
				closes stdin.
			</p>

			<div class="demos">
				<DemoCard
					title="Spawn-per-session Architecture"
					description="Kernel-enforced isolation: the server can read the repo and nothing else — no network, no writes, no persistence."
				>
					{#snippet visualization()}
						<FlowDiagram nodes={archNodes} edges={archEdges} ariaLabel="MCP server container architecture" />
					{/snippet}
					{#snippet dataTable()}
						<DiagGrid>
							<DiagRow label="Image"><code>docker.io/oven/bun:1.3.12</code></DiagRow>
							<DiagRow label="Mount"><code>{'-v <repo>:/v10r:ro'}</code></DiagRow>
							<DiagRow label="Network"><code>--network=none</code></DiagRow>
							<DiagRow label="Entry"><code>bun /v10r/mcp/server.ts</code></DiagRow>
							<DiagRow label="Lifecycle"><code>--rm</code> · exits on stdin EOF / SIGTERM / SIGINT</DiagRow>
						</DiagGrid>
					{/snippet}
					{#snippet code()}
						<pre><code>{`podman run -i --rm --network=none \\
  -v <repo>:/v10r:ro \\
  docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts`}</code></pre>
					{/snippet}
				</DemoCard>
			</div>
		</section>

		<!-- Tools & protocol -->
		<section id="tools-protocol" class="section">
			<h2 class="section-title">{m.showcase_mcp_section_tools()}</h2>
			<p class="section-description">
				The five read-only tools the server advertises, and the JSON-RPC handshake every session starts with.
			</p>

			<div class="tool-grid">
				{#each TOOL_CARDS as tool}
					<Card>
						{#snippet header()}
							<div class="tool-header">
								<span class="{tool.icon} text-icon-sm tool-icon" aria-hidden="true"></span>
								<code class="tool-name">{tool.name}</code>
							</div>
						{/snippet}
						<p class="tool-summary">{tool.summary}</p>
						<DiagGrid>
							{#each tool.params as param}
								<DiagRow label={param.name}>{param.detail}</DiagRow>
							{/each}
						</DiagGrid>
					</Card>
				{/each}
			</div>

			<div class="demos">
				<DemoCard
					title="MCP Handshake"
					description="The client → server sequence mcp/smoke.ts exercises. Notifications get no reply; tools/call repeats per invocation."
				>
					{#snippet visualization()}
						<StateDiagram nodes={handshakeNodes} edges={handshakeEdges} ariaLabel="MCP JSON-RPC handshake sequence" />
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Method</HeaderCell>
									<HeaderCell>Kind</HeaderCell>
									<HeaderCell>Purpose</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each HANDSHAKE_STEPS as step}
									<Row>
										<Cell><code>{step.method}</code></Cell>
										<Cell>{step.kind}</Cell>
										<Cell>{step.purpose}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
				</DemoCard>
			</div>
		</section>
	</main>

	{#snippet failed(error, reset)}
		<BoundaryFallback
			title="Visualization failed to render"
			description="The registry data may be in an unexpected format."
			{reset}
		/>
	{/snippet}
	</svelte:boundary>

	<BackLink href="/showcases" label={m.showcase_breadcrumb_showcases()} />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-3);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.stat-value {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		color: var(--color-fg);
		line-height: 1;
	}

	.stat-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.cat-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-4);
	}

	.cat-chip {
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		background: var(--color-subtle);
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}

	.lead {
		margin: 0 0 var(--spacing-8) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.lead a {
		color: var(--color-primary);
	}

	.lead code,
	.section-description code {
		background: var(--color-subtle);
		padding: 0.15em 0.4em;
		border-radius: var(--radius-sm);
		font-size: 0.9em;
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
		gap: var(--spacing-4);
	}

	.dag-caption {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.tool-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.tool-icon {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.tool-name {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		word-break: break-all;
	}

	.tool-summary {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
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
