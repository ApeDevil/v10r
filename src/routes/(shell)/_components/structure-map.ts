type Segment = { label: string; href: string | null };
type StructureItem = { segments: Segment[]; description: string };
type StructureGroup = {
	value: string;
	title: string;
	intro?: string;
	items: StructureItem[];
	note?: string;
};
type StructureSection = { value: string; title: string; groups: StructureGroup[] };

export type { Segment, StructureItem, StructureGroup, StructureSection };

export const sections: StructureSection[] = [
	{
		value: 'intelligence',
		title: 'Intelligence Layer',
		groups: [
			{
				value: 'agents',
				title: 'Agents',
				items: [
					{ segments: [{ label: 'archy', href: null }], description: 'architecture & system design' },
					{ segments: [{ label: 'arty', href: null }], description: 'aesthetic refinement & visual polish' },
					{ segments: [{ label: 'buny', href: null }], description: 'Bun runtime & tooling' },
					{ segments: [{ label: 'daty', href: null }], description: 'database schemas & data modeling' },
					{ segments: [{ label: 'docy', href: null }], description: 'documentation & technical writing' },
					{ segments: [{ label: 'resy', href: null }], description: 'technology research & evaluation' },
					{ segments: [{ label: 'scout', href: null }], description: 'real-world usage research' },
					{ segments: [{ label: 'secy', href: null }], description: 'security review & threat modeling' },
					{ segments: [{ label: 'svey', href: null }], description: 'SvelteKit application patterns' },
					{ segments: [{ label: 'tray', href: null }], description: 'debugging & error tracing' },
					{ segments: [{ label: 'uxy', href: null }], description: 'UI/UX design & accessibility' },
				],
			},
			{
				value: 'skills',
				title: 'Skills',
				items: [
					{
						segments: [
							{ label: 'svelte5-runes', href: null },
							{ label: 'sveltekit', href: null },
							{ label: 'unocss', href: null },
							{ label: 'biome', href: null },
						],
						description: 'core framework',
					},
					{
						segments: [
							{ label: 'drizzle', href: null },
							{ label: 'db-relational', href: null },
							{ label: 'db-graph', href: null },
							{ label: 'db-files', href: null },
						],
						description: 'data layer',
					},
					{
						segments: [
							{ label: 'better-auth', href: null },
							{ label: 'security', href: null },
						],
						description: 'auth & security',
					},
					{
						segments: [
							{ label: 'valibot-superforms', href: null },
							{ label: 'design-system', href: null },
						],
						description: 'forms & design',
					},
					{
						segments: [
							{ label: 'ai-tools', href: null },
							{ label: '3d', href: null },
						],
						description: 'AI & visualization',
					},
				],
			},
			{
				value: 'docs-hubs',
				title: 'Documentation Hubs',
				intro:
					'Each directory has a README.md navigation hub — brief intro, then a topic table linking to specific files.',
				items: [
					{ segments: [{ label: 'docs/foundation/', href: null }], description: 'core concepts & conventions' },
					{
						segments: [{ label: 'docs/stack/', href: '/docs/stack' }],
						description: 'technology documentation per layer',
					},
					{ segments: [{ label: 'docs/blueprint/', href: null }], description: 'architecture decisions' },
					{ segments: [{ label: 'docs/implementation/', href: null }], description: 'build details' },
					{ segments: [{ label: 'docs/patterns/', href: null }], description: 'reusable patterns' },
					{ segments: [{ label: 'docs/guides/', href: null }], description: 'how-to guides' },
				],
			},
		],
	},
	{
		value: 'structural',
		title: 'Structural Map',
		groups: [
			{
				value: 'routes',
				title: 'Routes',
				items: [
					{ segments: [{ label: '/app', href: '/app/dashboard' }], description: 'main application' },
					{ segments: [{ label: '/auth', href: '/auth/login' }], description: 'authentication flows' },
					{ segments: [{ label: '/showcases', href: '/showcases' }], description: 'feature demonstrations' },
					{ segments: [{ label: '/docs', href: '/docs' }], description: 'documentation viewer' },
					{ segments: [{ label: '/desk', href: '/desk' }], description: 'workspace' },
					{ segments: [{ label: '/api', href: null }], description: 'REST endpoints' },
				],
			},
			{
				value: 'server',
				title: 'Server Modules',
				items: [
					{
						segments: [
							{ label: 'ai', href: '/showcases/ai/retrieval/graph' },
							{ label: 'graph', href: '/showcases/ai/retrieval/graph' },
							{ label: 'retrieval', href: '/showcases/ai/retrieval/graph' },
						],
						description: 'intelligence',
					},
					{
						segments: [
							{ label: 'db', href: '/showcases/db/relational/connection' },
							{ label: 'cache', href: '/showcases/db/relational/connection' },
							{ label: 'store', href: '/showcases/db/relational/connection' },
						],
						description: 'persistence',
					},
					{
						segments: [
							{ label: 'auth', href: '/showcases/auth/session' },
							{ label: 'notifications', href: '/showcases/auth/session' },
						],
						description: 'identity & messaging',
					},
					{
						segments: [
							{ label: 'api', href: null },
							{ label: 'platform', href: null },
						],
						description: 'external interfaces',
					},
					{
						segments: [
							{ label: 'jobs', href: '/showcases/analytics/overview' },
							{ label: 'analytics', href: '/showcases/analytics/overview' },
						],
						description: 'background & telemetry',
					},
				],
			},
			{
				value: 'components',
				title: 'Components',
				items: [
					{
						segments: [{ label: 'primitives/', href: '/showcases/ui/components/primitives' }],
						description: 'atomic UI elements (accordion, button, input...)',
					},
					{
						segments: [{ label: 'composites/', href: '/showcases/ui/components/composites' }],
						description: 'assembled patterns (data-table, sidebar...)',
					},
					{
						segments: [{ label: 'layout/', href: '/showcases/ui/layouts' }],
						description: 'page structure (stack, grid, divider...)',
					},
					{
						segments: [{ label: 'shell/', href: '/showcases/shell/sidebar' }],
						description: 'app chrome (nav, footer, theme)',
					},
					{
						segments: [{ label: 'viz/', href: '/showcases/viz' }],
						description: 'charts & 3D (lazy-loaded, excluded from barrel)',
					},
				],
			},
			{
				value: 'claude',
				title: 'AI Infrastructure',
				items: [
					{ segments: [{ label: 'agents/', href: null }], description: '11 specialized Claude Code agents' },
					{ segments: [{ label: 'skills/', href: null }], description: '14 post-training knowledge modules' },
					{ segments: [{ label: 'memory/', href: null }], description: 'persistent agent memory across sessions' },
				],
			},
			{
				value: 'documentation',
				title: 'Documentation',
				items: [
					{ segments: [{ label: 'foundation/', href: null }], description: 'core concepts & conventions' },
					{ segments: [{ label: 'stack/', href: '/docs/stack' }], description: 'per-technology documentation' },
					{ segments: [{ label: 'blueprint/', href: null }], description: 'architecture decisions' },
					{ segments: [{ label: 'implementation/', href: null }], description: 'build details' },
					{ segments: [{ label: 'patterns/', href: null }], description: 'reusable patterns' },
				],
			},
		],
	},
];
