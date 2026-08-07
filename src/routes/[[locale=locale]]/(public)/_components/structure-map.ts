import * as m from '$lib/paraglide/messages';

type Segment = { label: string; href: string | null };
// description / intro are stored as Paraglide message-getter references
// (not invoked here) so the resolved string follows the per-request locale
// at render time. Calling m.x() at module scope freezes to the boot locale.
type StructureItem = { segments: Segment[]; description: () => string };
type StructureGroup = {
	value: string;
	title: string;
	intro?: () => string;
	items: StructureItem[];
	note?: string;
};
type StructureSection = { value: string; title: string; groups: StructureGroup[] };

export type { Segment, StructureItem, StructureGroup, StructureSection };

export const sections: StructureSection[] = [
	{
		value: 'programming-with-ai',
		title: 'Programming with AI',
		groups: [
			{
				value: 'agents',
				title: 'Agents',
				items: [
					{ segments: [{ label: 'arty', href: null }], description: m.home_structure_agent_arty_desc },
					{ segments: [{ label: 'daty', href: null }], description: m.home_structure_agent_daty_desc },
					{ segments: [{ label: 'docy', href: null }], description: m.home_structure_agent_docy_desc },
					{ segments: [{ label: 'resy', href: null }], description: m.home_structure_agent_resy_desc },
					{ segments: [{ label: 'scout', href: null }], description: m.home_structure_agent_scout_desc },
					{ segments: [{ label: 'secy', href: null }], description: m.home_structure_agent_secy_desc },
					{ segments: [{ label: 'svey', href: null }], description: m.home_structure_agent_svey_desc },
					{ segments: [{ label: 'tray', href: null }], description: m.home_structure_agent_tray_desc },
					{ segments: [{ label: 'uxy', href: null }], description: m.home_structure_agent_uxy_desc },
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
					{
						segments: [{ label: '/account', href: '/account/dashboard' }],
						description: m.home_structure_route_account_desc,
					},
					{ segments: [{ label: '/auth', href: '/auth/login' }], description: m.home_structure_route_auth_desc },
					{
						segments: [{ label: '/showcases', href: '/showcases' }],
						description: m.home_structure_route_showcases_desc,
					},
					{ segments: [{ label: '/docs', href: '/docs' }], description: m.home_structure_route_docs_desc },
					{ segments: [{ label: '/desk', href: '/desk' }], description: m.home_structure_route_desk_desc },
					{ segments: [{ label: '/api', href: null }], description: m.home_structure_route_api_desc },
				],
			},
			{
				value: 'server',
				title: 'Server Modules',
				items: [
					{
						segments: [
							{ label: 'ai', href: '/showcases/ai/retrieval' },
							{ label: 'graph', href: '/showcases/ai/retrieval/rag-chat?mode=graph' },
							{ label: 'retrieval', href: '/showcases/ai/retrieval/rag-chat' },
						],
						description: m.home_structure_server_ai_desc,
					},
					{
						segments: [
							{ label: 'db', href: '/showcases/db/relational/connection' },
							{ label: 'cache', href: '/showcases/db/relational/connection' },
							{ label: 'store', href: '/showcases/db/relational/connection' },
						],
						description: m.home_structure_server_db_desc,
					},
					{
						segments: [
							{ label: 'auth', href: '/showcases/auth/authn' },
							{ label: 'notifications', href: '/showcases/notifications/send' },
						],
						description: m.home_structure_server_auth_desc,
					},
					{
						segments: [
							{ label: 'api', href: null },
							{ label: 'platform', href: null },
						],
						description: m.home_structure_server_api_desc,
					},
					{
						segments: [
							{ label: 'jobs', href: '/showcases/analytics/overview' },
							{ label: 'analytics', href: '/showcases/analytics/overview' },
						],
						description: m.home_structure_server_jobs_desc,
					},
				],
			},
			{
				value: 'components',
				title: 'Components',
				items: [
					{
						segments: [{ label: 'primitives/', href: '/showcases/ui/components/primitives' }],
						description: m.home_structure_components_primitives_desc,
					},
					{
						segments: [{ label: 'composites/', href: '/showcases/ui/components/composites' }],
						description: m.home_structure_components_composites_desc,
					},
					{
						segments: [{ label: 'layout/', href: '/showcases/ui/layouts' }],
						description: m.home_structure_components_layout_desc,
					},
					{
						segments: [{ label: 'shell/', href: '/showcases/shell/sidebar' }],
						description: m.home_structure_components_shell_desc,
					},
					{
						segments: [{ label: 'viz/', href: '/showcases/viz' }],
						description: m.home_structure_components_viz_desc,
					},
				],
			},
			{
				value: 'claude',
				title: 'AI Infrastructure',
				items: [
					{ segments: [{ label: 'agents/', href: null }], description: m.home_structure_claude_agents_desc },
					{ segments: [{ label: 'skills/', href: null }], description: m.home_structure_claude_skills_desc },
					{ segments: [{ label: 'memory/', href: null }], description: m.home_structure_claude_memory_desc },
				],
			},
			{
				value: 'documentation',
				title: 'Documentation',
				items: [
					{
						segments: [{ label: 'foundation/', href: null }],
						description: m.home_structure_documentation_foundation_desc,
					},
					{
						segments: [{ label: 'stack/', href: '/docs/stack' }],
						description: m.home_structure_documentation_stack_desc,
					},
					{
						segments: [{ label: 'blueprint/', href: null }],
						description: m.home_structure_documentation_blueprint_desc,
					},
					{
						segments: [{ label: 'implementation/', href: null }],
						description: m.home_structure_documentation_impl_desc,
					},
					{
						segments: [{ label: 'pattern-library/', href: '/docs/pattern-library' }],
						description: m.home_structure_documentation_patterns_desc,
					},
				],
			},
		],
	},
];
