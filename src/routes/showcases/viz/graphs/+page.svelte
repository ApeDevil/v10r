<script lang="ts">
	import { PageHeader, BackLink, SectionNav } from '$lib/components/composites';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives/table';
	import VizDemoCard from '../_components/VizDemoCard.svelte';
	import { NetworkGraph, TreeGraph, DagGraph, SankeyDiagram, KnowledgeGraph } from '$lib/components/viz';
	import type { NetworkData, TreeData, DagData, SankeyData, KnowledgeData } from '$lib/components/viz/graph';

	const sections = [
		{ id: 'network-graph', label: 'Network' },
		{ id: 'directed-graph', label: 'Directed' },
		{ id: 'tree-graph', label: 'Tree' },
		{ id: 'dag-graph', label: 'DAG' },
		{ id: 'sankey-diagram', label: 'Sankey' },
		{ id: 'knowledge-graph', label: 'Knowledge' },
		{ id: 'layout-comparison', label: 'Comparison' },
	];

	// --- Sample Data: Social Network (undirected) ---
	const socialNetwork: NetworkData = {
		nodes: [
			{ id: 'alice', label: 'Alice', group: 'engineering', size: 8 },
			{ id: 'bob', label: 'Bob', group: 'engineering', size: 7 },
			{ id: 'carol', label: 'Carol', group: 'design', size: 7 },
			{ id: 'dave', label: 'Dave', group: 'design', size: 6 },
			{ id: 'eve', label: 'Eve', group: 'product', size: 8 },
			{ id: 'frank', label: 'Frank', group: 'product', size: 6 },
			{ id: 'grace', label: 'Grace', group: 'engineering', size: 7 },
			{ id: 'hank', label: 'Hank', group: 'data', size: 6 },
			{ id: 'iris', label: 'Iris', group: 'data', size: 5 },
			{ id: 'jack', label: 'Jack', group: 'engineering', size: 6 },
		],
		edges: [
			{ source: 'alice', target: 'bob' },
			{ source: 'alice', target: 'carol' },
			{ source: 'alice', target: 'eve' },
			{ source: 'bob', target: 'grace' },
			{ source: 'bob', target: 'jack' },
			{ source: 'carol', target: 'dave' },
			{ source: 'carol', target: 'eve' },
			{ source: 'dave', target: 'frank' },
			{ source: 'eve', target: 'frank' },
			{ source: 'eve', target: 'hank' },
			{ source: 'grace', target: 'jack' },
			{ source: 'hank', target: 'iris' },
			{ source: 'alice', target: 'hank' },
		],
	};

	// --- Sample Data: Citation Network (directed) ---
	const citationNetwork: NetworkData = {
		nodes: [
			{ id: 'paper-a', label: 'Paper A', group: 'ml', size: 9 },
			{ id: 'paper-b', label: 'Paper B', group: 'ml', size: 7 },
			{ id: 'paper-c', label: 'Paper C', group: 'nlp', size: 8 },
			{ id: 'paper-d', label: 'Paper D', group: 'nlp', size: 6 },
			{ id: 'paper-e', label: 'Paper E', group: 'cv', size: 7 },
			{ id: 'paper-f', label: 'Paper F', group: 'cv', size: 6 },
			{ id: 'paper-g', label: 'Paper G', group: 'ml', size: 5 },
			{ id: 'paper-h', label: 'Paper H', group: 'systems', size: 6 },
		],
		edges: [
			{ source: 'paper-b', target: 'paper-a' },
			{ source: 'paper-c', target: 'paper-a' },
			{ source: 'paper-c', target: 'paper-b' },
			{ source: 'paper-d', target: 'paper-c' },
			{ source: 'paper-e', target: 'paper-a' },
			{ source: 'paper-e', target: 'paper-b' },
			{ source: 'paper-f', target: 'paper-e' },
			{ source: 'paper-g', target: 'paper-a' },
			{ source: 'paper-g', target: 'paper-b' },
			{ source: 'paper-h', target: 'paper-a' },
			{ source: 'paper-d', target: 'paper-h' },
		],
	};

	// --- Sample Data: Weighted Network ---
	const weightedNetwork: NetworkData = {
		nodes: [
			{ id: 'server-1', label: 'Server 1', group: 'frontend', size: 8 },
			{ id: 'server-2', label: 'Server 2', group: 'frontend', size: 7 },
			{ id: 'api-1', label: 'API 1', group: 'backend', size: 9 },
			{ id: 'api-2', label: 'API 2', group: 'backend', size: 7 },
			{ id: 'db-1', label: 'DB Primary', group: 'database', size: 10 },
			{ id: 'db-2', label: 'DB Replica', group: 'database', size: 8 },
			{ id: 'cache', label: 'Cache', group: 'infra', size: 7 },
			{ id: 'queue', label: 'Queue', group: 'infra', size: 6 },
		],
		edges: [
			{ source: 'server-1', target: 'api-1', weight: 5 },
			{ source: 'server-1', target: 'api-2', weight: 3 },
			{ source: 'server-2', target: 'api-1', weight: 4 },
			{ source: 'server-2', target: 'api-2', weight: 2 },
			{ source: 'api-1', target: 'db-1', weight: 8 },
			{ source: 'api-1', target: 'cache', weight: 6 },
			{ source: 'api-2', target: 'db-1', weight: 4 },
			{ source: 'api-2', target: 'queue', weight: 3 },
			{ source: 'db-1', target: 'db-2', weight: 7 },
			{ source: 'cache', target: 'db-1', weight: 2 },
		],
	};

	// --- Sample Data: Org Chart Tree ---
	const orgChart: TreeData = {
		id: 'ceo',
		label: 'CEO',
		children: [
			{
				id: 'cto',
				label: 'CTO',
				children: [
					{
						id: 'eng-lead',
						label: 'Eng Lead',
						children: [
							{ id: 'dev-1', label: 'Dev 1' },
							{ id: 'dev-2', label: 'Dev 2' },
							{ id: 'dev-3', label: 'Dev 3' },
						],
					},
					{
						id: 'data-lead',
						label: 'Data Lead',
						children: [
							{ id: 'analyst-1', label: 'Analyst 1' },
							{ id: 'analyst-2', label: 'Analyst 2' },
						],
					},
				],
			},
			{
				id: 'cpo',
				label: 'CPO',
				children: [
					{
						id: 'pm-lead',
						label: 'PM Lead',
						children: [
							{ id: 'pm-1', label: 'PM 1' },
							{ id: 'pm-2', label: 'PM 2' },
						],
					},
					{
						id: 'design-lead',
						label: 'Design Lead',
						children: [
							{ id: 'designer-1', label: 'Designer 1' },
							{ id: 'designer-2', label: 'Designer 2' },
						],
					},
				],
			},
			{
				id: 'cfo',
				label: 'CFO',
				children: [
					{ id: 'finance-1', label: 'Finance 1' },
					{ id: 'finance-2', label: 'Finance 2' },
				],
			},
		],
	};

	// --- Sample Data: File System Tree ---
	const fileSystem: TreeData = {
		id: 'src',
		label: 'src/',
		children: [
			{
				id: 'lib',
				label: 'lib/',
				children: [
					{
						id: 'components',
						label: 'components/',
						children: [
							{ id: 'primitives', label: 'primitives/' },
							{ id: 'composites', label: 'composites/' },
							{
								id: 'viz',
								label: 'viz/',
								children: [
									{ id: 'chart', label: 'chart/' },
									{ id: 'graph', label: 'graph/' },
								],
							},
						],
					},
					{
						id: 'utils',
						label: 'utils/',
						children: [
							{ id: 'cn', label: 'cn.ts' },
							{ id: 'format', label: 'format.ts' },
						],
					},
				],
			},
			{
				id: 'routes',
				label: 'routes/',
				children: [
					{ id: 'page', label: '+page.svelte' },
					{
						id: 'showcases',
						label: 'showcases/',
						children: [
							{ id: 'viz-route', label: 'viz/' },
						],
					},
				],
			},
		],
	};

	// --- Sample Data: Package Dependencies DAG ---
	const packageDeps: DagData = {
		nodes: [
			{ id: 'app', label: 'App' },
			{ id: 'sveltekit', label: 'SvelteKit' },
			{ id: 'svelte', label: 'Svelte' },
			{ id: 'vite', label: 'Vite' },
			{ id: 'esbuild', label: 'esbuild' },
			{ id: 'rollup', label: 'Rollup' },
			{ id: 'unocss', label: 'UnoCSS' },
			{ id: 'drizzle', label: 'Drizzle' },
			{ id: 'pg', label: 'pg' },
		],
		edges: [
			{ source: 'app', target: 'sveltekit' },
			{ source: 'app', target: 'unocss' },
			{ source: 'app', target: 'drizzle' },
			{ source: 'sveltekit', target: 'svelte' },
			{ source: 'sveltekit', target: 'vite' },
			{ source: 'vite', target: 'esbuild' },
			{ source: 'vite', target: 'rollup' },
			{ source: 'unocss', target: 'vite' },
			{ source: 'drizzle', target: 'pg' },
		],
	};

	// --- Sample Data: Task Pipeline DAG ---
	const taskPipeline: DagData = {
		nodes: [
			{ id: 'fetch', label: 'Fetch', group: 'input' },
			{ id: 'validate', label: 'Validate', group: 'input' },
			{ id: 'transform', label: 'Transform', group: 'process' },
			{ id: 'enrich', label: 'Enrich', group: 'process' },
			{ id: 'dedupe', label: 'Dedupe', group: 'process' },
			{ id: 'index', label: 'Index', group: 'output' },
			{ id: 'notify', label: 'Notify', group: 'output' },
		],
		edges: [
			{ source: 'fetch', target: 'validate' },
			{ source: 'validate', target: 'transform' },
			{ source: 'validate', target: 'enrich' },
			{ source: 'transform', target: 'dedupe' },
			{ source: 'enrich', target: 'dedupe' },
			{ source: 'dedupe', target: 'index' },
			{ source: 'dedupe', target: 'notify' },
		],
	};

	// --- Sample Data: Energy Flow Sankey ---
	const energyFlow: SankeyData = {
		nodes: [
			{ id: 'solar', label: 'Solar', category: 'source' },
			{ id: 'wind', label: 'Wind', category: 'source' },
			{ id: 'gas', label: 'Gas', category: 'source' },
			{ id: 'grid', label: 'Grid', category: 'distribution' },
			{ id: 'storage', label: 'Storage', category: 'distribution' },
			{ id: 'residential', label: 'Residential', category: 'consumption' },
			{ id: 'commercial', label: 'Commercial', category: 'consumption' },
			{ id: 'industrial', label: 'Industrial', category: 'consumption' },
			{ id: 'losses', label: 'Losses', category: 'waste' },
		],
		edges: [
			{ source: 'solar', target: 'grid', value: 120 },
			{ source: 'solar', target: 'storage', value: 30 },
			{ source: 'wind', target: 'grid', value: 80 },
			{ source: 'wind', target: 'storage', value: 20 },
			{ source: 'gas', target: 'grid', value: 200 },
			{ source: 'storage', target: 'grid', value: 40 },
			{ source: 'grid', target: 'residential', value: 180 },
			{ source: 'grid', target: 'commercial', value: 150 },
			{ source: 'grid', target: 'industrial', value: 80 },
			{ source: 'grid', target: 'losses', value: 30 },
		],
	};

	// --- Sample Data: User Funnel Sankey ---
	const userFunnel: SankeyData = {
		nodes: [
			{ id: 'visit', label: 'Visit', category: 'top' },
			{ id: 'signup', label: 'Sign Up', category: 'middle' },
			{ id: 'activate', label: 'Activate', category: 'middle' },
			{ id: 'subscribe', label: 'Subscribe', category: 'bottom' },
			{ id: 'churn', label: 'Churn', category: 'exit' },
			{ id: 'bounce', label: 'Bounce', category: 'exit' },
		],
		edges: [
			{ source: 'visit', target: 'signup', value: 400 },
			{ source: 'visit', target: 'bounce', value: 600 },
			{ source: 'signup', target: 'activate', value: 300 },
			{ source: 'signup', target: 'churn', value: 100 },
			{ source: 'activate', target: 'subscribe', value: 200 },
			{ source: 'activate', target: 'churn', value: 100 },
		],
	};

	// --- Sample Data: Movie Knowledge Graph ---
	const movieKG: KnowledgeData = {
		entityTypes: ['Person', 'Movie', 'Genre'],
		relationshipTypes: ['ACTED_IN', 'DIRECTED', 'HAS_GENRE'],
		nodes: [
			{ id: 'nolan', label: 'C. Nolan', entityType: 'Person' },
			{ id: 'dicaprio', label: 'DiCaprio', entityType: 'Person' },
			{ id: 'hardy', label: 'T. Hardy', entityType: 'Person' },
			{ id: 'caine', label: 'M. Caine', entityType: 'Person' },
			{ id: 'hathaway', label: 'Hathaway', entityType: 'Person' },
			{ id: 'inception', label: 'Inception', entityType: 'Movie' },
			{ id: 'interstellar', label: 'Interstellar', entityType: 'Movie' },
			{ id: 'dark-knight', label: 'Dark Knight', entityType: 'Movie' },
			{ id: 'tenet', label: 'Tenet', entityType: 'Movie' },
			{ id: 'scifi', label: 'Sci-Fi', entityType: 'Genre' },
			{ id: 'action', label: 'Action', entityType: 'Genre' },
			{ id: 'thriller', label: 'Thriller', entityType: 'Genre' },
		],
		edges: [
			{ source: 'nolan', target: 'inception', relationshipType: 'DIRECTED' },
			{ source: 'nolan', target: 'interstellar', relationshipType: 'DIRECTED' },
			{ source: 'nolan', target: 'dark-knight', relationshipType: 'DIRECTED' },
			{ source: 'nolan', target: 'tenet', relationshipType: 'DIRECTED' },
			{ source: 'dicaprio', target: 'inception', relationshipType: 'ACTED_IN' },
			{ source: 'hardy', target: 'inception', relationshipType: 'ACTED_IN' },
			{ source: 'hardy', target: 'dark-knight', relationshipType: 'ACTED_IN' },
			{ source: 'caine', target: 'inception', relationshipType: 'ACTED_IN' },
			{ source: 'caine', target: 'interstellar', relationshipType: 'ACTED_IN' },
			{ source: 'caine', target: 'dark-knight', relationshipType: 'ACTED_IN' },
			{ source: 'hathaway', target: 'interstellar', relationshipType: 'ACTED_IN' },
			{ source: 'hathaway', target: 'dark-knight', relationshipType: 'ACTED_IN' },
			{ source: 'inception', target: 'scifi', relationshipType: 'HAS_GENRE' },
			{ source: 'inception', target: 'action', relationshipType: 'HAS_GENRE' },
			{ source: 'interstellar', target: 'scifi', relationshipType: 'HAS_GENRE' },
			{ source: 'dark-knight', target: 'action', relationshipType: 'HAS_GENRE' },
			{ source: 'dark-knight', target: 'thriller', relationshipType: 'HAS_GENRE' },
			{ source: 'tenet', target: 'scifi', relationshipType: 'HAS_GENRE' },
			{ source: 'tenet', target: 'action', relationshipType: 'HAS_GENRE' },
		],
	};

	// --- Layout Comparison: same data for network, tree, DAG ---
	const comparisonNetwork: NetworkData = {
		nodes: [
			{ id: 'a', label: 'A', group: 'root' },
			{ id: 'b', label: 'B', group: 'mid' },
			{ id: 'c', label: 'C', group: 'mid' },
			{ id: 'd', label: 'D', group: 'leaf' },
			{ id: 'e', label: 'E', group: 'leaf' },
			{ id: 'f', label: 'F', group: 'leaf' },
		],
		edges: [
			{ source: 'a', target: 'b' },
			{ source: 'a', target: 'c' },
			{ source: 'b', target: 'd' },
			{ source: 'b', target: 'e' },
			{ source: 'c', target: 'f' },
		],
	};

	const comparisonTree: TreeData = {
		id: 'a',
		label: 'A',
		children: [
			{
				id: 'b',
				label: 'B',
				children: [
					{ id: 'd', label: 'D' },
					{ id: 'e', label: 'E' },
				],
			},
			{
				id: 'c',
				label: 'C',
				children: [{ id: 'f', label: 'F' }],
			},
		],
	};

	const comparisonDag: DagData = {
		nodes: [
			{ id: 'a', label: 'A' },
			{ id: 'b', label: 'B' },
			{ id: 'c', label: 'C' },
			{ id: 'd', label: 'D' },
			{ id: 'e', label: 'E' },
			{ id: 'f', label: 'F' },
		],
		edges: [
			{ source: 'a', target: 'b' },
			{ source: 'a', target: 'c' },
			{ source: 'b', target: 'd' },
			{ source: 'b', target: 'e' },
			{ source: 'c', target: 'f' },
		],
	};

	// --- Helpers ---
	function flattenTree(node: TreeData, depth = 0): Array<{ id: string; label: string; depth: number; childCount: number }> {
		const result: Array<{ id: string; label: string; depth: number; childCount: number }> = [];
		result.push({
			id: node.id,
			label: node.label || node.id,
			depth,
			childCount: node.children?.length ?? 0,
		});
		for (const child of node.children ?? []) {
			result.push(...flattenTree(child, depth + 1));
		}
		return result;
	}
</script>

<svelte:head>
	<title>Graphs - Viz Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Graphs"
		description="Network, directed, tree, DAG, Sankey, and knowledge graph visualizations. D3 modules for layout math, Svelte renders all SVG."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz', href: '/showcases/viz' },
			{ label: 'Graphs' }
		]}
	/>

	<SectionNav {sections} />

	<main class="content">
		<!-- Network Graph -->
		<section id="network-graph" class="section">
			<h2 class="section-title">Network Graph</h2>
			<p class="section-description">Force-directed layout using D3-force. Drag nodes, click to select and highlight connections. Ctrl/Cmd+scroll to zoom.</p>

			<div class="demos">
				<VizDemoCard
					title="Social Network"
					description="Force-directed graph showing team connections. Nodes colored by department."
				>
					{#snippet visualization()}
						<NetworkGraph
							data={socialNetwork}
							ariaLabel="Social network showing team connections"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Node</HeaderCell>
									<HeaderCell>Group</HeaderCell>
									<HeaderCell>Connected To</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each socialNetwork.nodes as node}
									<Row>
										<Cell>{node.label}</Cell>
										<Cell>{node.group}</Cell>
										<Cell>
											{socialNetwork.edges
												.filter((e) => e.source === node.id || e.target === node.id)
												.map((e) => {
													const otherId = e.source === node.id ? e.target : e.source;
													return socialNetwork.nodes.find((n) => n.id === otherId)?.label ?? otherId;
												})
												.join(', ')}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<NetworkGraph
  data={{
    nodes: [
      { id: 'alice', label: 'Alice', group: 'engineering', size: 8 },
      { id: 'bob', label: 'Bob', group: 'engineering', size: 7 },
      // ...
    ],
    edges: [
      { source: 'alice', target: 'bob' },
      { source: 'alice', target: 'carol' },
      // ...
    ],
  }}
  ariaLabel="Social network"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Infrastructure Map"
					description="Weighted network showing server-to-service connections."
				>
					{#snippet visualization()}
						<NetworkGraph
							data={weightedNetwork}
							ariaLabel="Infrastructure map showing service connections"
						/>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Directed Graph -->
		<section id="directed-graph" class="section">
			<h2 class="section-title">Directed Graph</h2>
			<p class="section-description">Same NetworkGraph component with <code>directed</code> prop. Adds arrow markers to edges showing direction.</p>

			<div class="demos">
				<VizDemoCard
					title="Citation Network"
					description="Directed graph showing which papers cite which. Arrows point from citing paper to cited paper."
				>
					{#snippet visualization()}
						<NetworkGraph
							data={citationNetwork}
							directed
							ariaLabel="Citation network showing paper references"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Paper</HeaderCell>
									<HeaderCell>Field</HeaderCell>
									<HeaderCell>Cites</HeaderCell>
									<HeaderCell>Cited By</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each citationNetwork.nodes as node}
									<Row>
										<Cell>{node.label}</Cell>
										<Cell>{node.group}</Cell>
										<Cell>
											{citationNetwork.edges
												.filter((e) => e.source === node.id)
												.map((e) => citationNetwork.nodes.find((n) => n.id === e.target)?.label ?? e.target)
												.join(', ') || '\u2014'}
										</Cell>
										<Cell>
											{citationNetwork.edges
												.filter((e) => e.target === node.id)
												.map((e) => citationNetwork.nodes.find((n) => n.id === e.source)?.label ?? e.source)
												.join(', ') || '\u2014'}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<NetworkGraph
  data={citationNetwork}
  directed
  ariaLabel="Citation network"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Tree Graph -->
		<section id="tree-graph" class="section">
			<h2 class="section-title">Tree Diagram</h2>
			<p class="section-description">Hierarchical layout using D3-hierarchy. Click nodes to expand/collapse branches. Supports horizontal and vertical orientations.</p>

			<div class="demos">
				<VizDemoCard
					title="Organization Chart"
					description="Horizontal tree showing company hierarchy. Click +/\u2212 to expand or collapse branches."
				>
					{#snippet visualization()}
						<TreeGraph
							data={orgChart}
							orientation="horizontal"
							ariaLabel="Organization chart showing company structure"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Name</HeaderCell>
									<HeaderCell>Depth</HeaderCell>
									<HeaderCell>Direct Reports</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each flattenTree(orgChart) as row}
									<Row>
										<Cell>{'  '.repeat(row.depth)}{row.label}</Cell>
										<Cell>{row.depth}</Cell>
										<Cell>{row.childCount}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<TreeGraph
  data={{
    id: 'ceo', label: 'CEO',
    children: [
      { id: 'cto', label: 'CTO', children: [...] },
      { id: 'cpo', label: 'CPO', children: [...] },
      { id: 'cfo', label: 'CFO', children: [...] },
    ],
  }}
  orientation="horizontal"
  ariaLabel="Organization chart"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="File System"
					description="Vertical tree showing directory structure. Top-to-bottom layout."
				>
					{#snippet visualization()}
						<TreeGraph
							data={fileSystem}
							orientation="vertical"
							ariaLabel="File system directory structure"
						/>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- DAG Graph -->
		<section id="dag-graph" class="section">
			<h2 class="section-title">DAG Visualization</h2>
			<p class="section-description">Directed acyclic graph layout using d3-dag Sugiyama algorithm. Nodes arranged in layers with minimized edge crossings.</p>

			<div class="demos">
				<VizDemoCard
					title="Package Dependencies"
					description="Layered dependency graph showing package relationships. Arrows flow from dependents to dependencies."
				>
					{#snippet visualization()}
						<DagGraph
							data={packageDeps}
							ariaLabel="Package dependency graph"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Package</HeaderCell>
									<HeaderCell>Depends On</HeaderCell>
									<HeaderCell>Depended By</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each packageDeps.nodes as node}
									<Row>
										<Cell>{node.label}</Cell>
										<Cell>
											{packageDeps.edges
												.filter((e) => e.source === node.id)
												.map((e) => packageDeps.nodes.find((n) => n.id === e.target)?.label ?? e.target)
												.join(', ') || '\u2014'}
										</Cell>
										<Cell>
											{packageDeps.edges
												.filter((e) => e.target === node.id)
												.map((e) => packageDeps.nodes.find((n) => n.id === e.source)?.label ?? e.source)
												.join(', ') || '\u2014'}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<DagGraph
  data={{
    nodes: [
      { id: 'app', label: 'App' },
      { id: 'sveltekit', label: 'SvelteKit' },
      // ...
    ],
    edges: [
      { source: 'app', target: 'sveltekit' },
      { source: 'sveltekit', target: 'svelte' },
      // ...
    ],
  }}
  ariaLabel="Package dependencies"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Task Pipeline"
					description="Data processing pipeline showing task flow from input through processing to output."
				>
					{#snippet visualization()}
						<DagGraph
							data={taskPipeline}
							ariaLabel="Task pipeline showing data processing flow"
						/>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Sankey Diagram -->
		<section id="sankey-diagram" class="section">
			<h2 class="section-title">Sankey Diagram</h2>
			<p class="section-description">Flow visualization using d3-sankey. Width of flows proportional to value. Hover nodes to highlight connected flows.</p>

			<div class="demos">
				<VizDemoCard
					title="Energy Flow"
					description="Multi-stage energy flow from sources through distribution to consumption. Gradient-colored flows."
				>
					{#snippet visualization()}
						<SankeyDiagram
							data={energyFlow}
							ariaLabel="Energy flow diagram"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>From</HeaderCell>
									<HeaderCell>To</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each energyFlow.edges as edge}
									<Row>
										<Cell>{energyFlow.nodes.find((n) => n.id === edge.source)?.label ?? edge.source}</Cell>
										<Cell>{energyFlow.nodes.find((n) => n.id === edge.target)?.label ?? edge.target}</Cell>
										<Cell>{edge.value}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<SankeyDiagram
  data={{
    nodes: [
      { id: 'solar', label: 'Solar', category: 'source' },
      { id: 'grid', label: 'Grid', category: 'distribution' },
      // ...
    ],
    edges: [
      { source: 'solar', target: 'grid', value: 120 },
      { source: 'grid', target: 'residential', value: 180 },
      // ...
    ],
  }}
  ariaLabel="Energy flow diagram"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="User Funnel"
					description="Conversion funnel showing user progression from visit to subscription, with churn and bounce exits."
				>
					{#snippet visualization()}
						<SankeyDiagram
							data={userFunnel}
							ariaLabel="User conversion funnel"
						/>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Knowledge Graph -->
		<section id="knowledge-graph" class="section">
			<h2 class="section-title">Knowledge Graph</h2>
			<p class="section-description">Filtered network graph with entity and relationship type controls. Wraps NetworkGraph with domain-specific filtering.</p>

			<div class="demos">
				<VizDemoCard
					title="Movie Database"
					description="Knowledge graph showing movies, people, and genres. Use filters to show/hide entity and relationship types."
				>
					{#snippet visualization()}
						<KnowledgeGraph
							data={movieKG}
							ariaLabel="Movie database knowledge graph"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Entity</HeaderCell>
									<HeaderCell>Type</HeaderCell>
									<HeaderCell>Connections</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each movieKG.nodes as node}
									<Row>
										<Cell>{node.label}</Cell>
										<Cell>{node.entityType}</Cell>
										<Cell>
											{movieKG.edges
												.filter((e) => e.source === node.id || e.target === node.id)
												.map((e) => {
													const otherId = e.source === node.id ? e.target : e.source;
													return `${movieKG.nodes.find((n) => n.id === otherId)?.label ?? otherId} (${e.relationshipType})`;
												})
												.join(', ')}
										</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<KnowledgeGraph
  data={{
    entityTypes: ['Person', 'Movie', 'Genre'],
    relationshipTypes: ['ACTED_IN', 'DIRECTED', 'HAS_GENRE'],
    nodes: [
      { id: 'nolan', label: 'C. Nolan', entityType: 'Person' },
      { id: 'inception', label: 'Inception', entityType: 'Movie' },
      // ...
    ],
    edges: [
      { source: 'nolan', target: 'inception', relationshipType: 'DIRECTED' },
      // ...
    ],
  }}
  ariaLabel="Movie database knowledge graph"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Layout Comparison -->
		<section id="layout-comparison" class="section">
			<h2 class="section-title">Layout Comparison</h2>
			<p class="section-description">Same data rendered with three different layout algorithms. Force-directed (physics), tree (hierarchy), and DAG (layered).</p>

			<div class="comparison-grid">
				<VizDemoCard
					title="Force Layout"
					description="Physics-based positioning. Nodes repel, edges attract."
				>
					{#snippet visualization()}
						<NetworkGraph
							data={comparisonNetwork}
							ariaLabel="Force-directed layout of comparison data"
						/>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="Tree Layout"
					description="Hierarchical positioning. Parent-child structure."
				>
					{#snippet visualization()}
						<TreeGraph
							data={comparisonTree}
							orientation="horizontal"
							ariaLabel="Tree layout of comparison data"
						/>
					{/snippet}
				</VizDemoCard>

				<VizDemoCard
					title="DAG Layout"
					description="Layered positioning. Minimized edge crossings."
				>
					{#snippet visualization()}
						<DagGraph
							data={comparisonDag}
							ariaLabel="DAG layout of comparison data"
						/>
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

	.content {
		padding-top: var(--spacing-7);
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

	.section-description code {
		background: var(--color-subtle);
		padding: 0.15em 0.4em;
		border-radius: var(--radius-sm);
		font-size: 0.9em;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
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
