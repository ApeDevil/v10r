export interface ShowcaseSublink {
	label: string;
	href: string;
	children?: ShowcaseSublink[];
}

interface ShowcaseCard {
	href: string;
	icon: string;
	title: string;
	description: string;
	sublinks?: ShowcaseSublink[];
}

export function getShowcaseTabs(basePath: string) {
	return showcases.find((s) => s.href === basePath)?.sublinks ?? [];
}

export function getShowcaseSubTabs(parentPath: string): { label: string; href: string }[] {
	for (const card of showcases) {
		if (!card.sublinks) continue;
		for (const sub of card.sublinks) {
			if (sub.href === parentPath && sub.children) {
				return sub.children.map((c) => ({ label: c.label, href: c.href }));
			}
		}
	}
	return [];
}

export const showcases: ShowcaseCard[] = [
	{
		href: '/showcases/shell',
		icon: 'i-lucide-layout',
		title: 'App Shell',
		description: 'Keyboard shortcuts, modals, toasts, session lifecycle, navigation',
		sublinks: [
			{ label: 'Sidebar', href: '/showcases/shell/sidebar' },
			{ label: 'Theme', href: '/showcases/shell/theme' },
			{ label: 'Toasts', href: '/showcases/shell/toasts' },
			{ label: 'Modals', href: '/showcases/shell/modals' },
			{ label: 'Shortcuts', href: '/showcases/shell/shortcuts' },
			{ label: 'Errors', href: '/showcases/shell/errors' },
			{ label: 'Session', href: '/showcases/shell/session' },
		],
	},
	{
		href: '/showcases/ui',
		icon: 'i-lucide-palette',
		title: 'UI Components',
		description: 'Complete UI component library and design tokens',
		sublinks: [
			{
				label: 'Components',
				href: '/showcases/ui/components',
				children: [
					{ label: 'Primitives', href: '/showcases/ui/components/primitives' },
					{ label: 'Composites', href: '/showcases/ui/components/composites' },
				],
			},
			{ label: 'Layouts', href: '/showcases/ui/layouts' },
			{ label: 'Tables', href: '/showcases/ui/tables' },
			{ label: 'Menus', href: '/showcases/ui/menus' },
			{
				label: 'Splits',
				href: '/showcases/ui/splits',
				children: [
					{ label: 'Resizable', href: '/showcases/ui/splits/resizable' },
					{ label: 'Reorderable', href: '/showcases/ui/splits/reorderable' },
				],
			},
			{ label: 'Workbench', href: '/showcases/ui/workbench' },
			{
				label: 'Decorative',
				href: '/showcases/ui/decorative',
				children: [
					{ label: 'Ornaments', href: '/showcases/ui/decorative/ornaments' },
					{ label: 'Backgrounds', href: '/showcases/ui/decorative/backgrounds' },
				],
			},
			{ label: 'Typography', href: '/showcases/ui/typography' },
			{ label: 'Tokens', href: '/showcases/ui/tokens' },
		],
	},
	{
		href: '/showcases/forms',
		icon: 'i-lucide-text-cursor-input',
		title: 'Forms',
		description: 'Superforms + Valibot validation, patterns, and advanced techniques',
		sublinks: [
			{
				label: 'Basics',
				href: '/showcases/forms/basics',
				children: [
					{ label: 'Contact', href: '/showcases/forms/basics/contact' },
					{ label: 'Settings', href: '/showcases/forms/basics/settings' },
				],
			},
			{
				label: 'Validation',
				href: '/showcases/forms/validation',
				children: [
					{ label: 'Realtime', href: '/showcases/forms/validation/realtime' },
					{ label: 'Async', href: '/showcases/forms/validation/async' },
					{ label: 'Server', href: '/showcases/forms/validation/server' },
				],
			},
			{
				label: 'Patterns',
				href: '/showcases/forms/patterns',
				children: [
					{ label: 'Wizard', href: '/showcases/forms/patterns/wizard' },
					{ label: 'Dynamic', href: '/showcases/forms/patterns/dynamic' },
					{ label: 'Dependent', href: '/showcases/forms/patterns/dependent' },
				],
			},
			{
				label: 'Advanced',
				href: '/showcases/forms/advanced',
				children: [
					{ label: 'Confirm', href: '/showcases/forms/advanced/confirm' },
					{ label: 'Reset', href: '/showcases/forms/advanced/reset' },
					{ label: 'Edit', href: '/showcases/forms/advanced/edit' },
				],
			},
			{ label: 'Auth', href: '/showcases/forms/auth' },
		],
	},
	{
		href: '/showcases/viz',
		icon: 'i-lucide-bar-chart-3',
		title: 'Data Viz',
		description: 'Charts, plots, diagrams, and data visualization',
		sublinks: [
			{ label: 'Charts', href: '/showcases/viz/charts' },
			{ label: 'Plots', href: '/showcases/viz/plots' },
			{ label: 'Diagrams', href: '/showcases/viz/diagrams' },
			{ label: 'Graphs', href: '/showcases/viz/graphs' },
			{ label: 'Maps', href: '/showcases/viz/maps' },
		],
	},
	{
		href: '/showcases/3d',
		icon: 'i-lucide-box',
		title: '3D',
		description: 'Three.js + Threlte 3D scenes',
		sublinks: [
			{ label: 'Static Scene', href: '/showcases/3d/static-scene' },
			{ label: 'Animated Scene', href: '/showcases/3d/animated-scene' },
		],
	},
	{
		href: '/showcases/db',
		icon: 'i-lucide-server',
		title: 'Database',
		description: 'PostgreSQL, Neo4j, R2, Redis — connections, types, queries, and storage',
		sublinks: [
			{
				label: 'Relational',
				href: '/showcases/db/relational',
				children: [
					{ label: 'Connection', href: '/showcases/db/relational/connection' },
					{ label: 'Types', href: '/showcases/db/relational/types' },
					{ label: 'Mutability', href: '/showcases/db/relational/mutability' },
				],
			},
			{
				label: 'Graph',
				href: '/showcases/db/graph',
				children: [
					{ label: 'Connection', href: '/showcases/db/graph/connection' },
					{ label: 'Model', href: '/showcases/db/graph/model' },
					{ label: 'Traversal', href: '/showcases/db/graph/traversal' },
				],
			},
			{
				label: 'Storage',
				href: '/showcases/db/storage',
				children: [
					{ label: 'Connection', href: '/showcases/db/storage/connection' },
					{ label: 'Objects', href: '/showcases/db/storage/objects' },
					{ label: 'Transfer', href: '/showcases/db/storage/transfer' },
				],
			},
			{
				label: 'Cache',
				href: '/showcases/db/cache',
				children: [
					{ label: 'Connection', href: '/showcases/db/cache/connection' },
					{ label: 'Patterns', href: '/showcases/db/cache/patterns' },
					{ label: 'Ephemeral', href: '/showcases/db/cache/ephemeral' },
				],
			},
		],
	},
	{
		href: '/showcases/auth',
		icon: 'i-lucide-lock',
		title: 'Auth',
		description: 'Better Auth authentication flows',
		sublinks: [
			{ label: 'Connection', href: '/showcases/auth/connection' },
			{ label: 'Session', href: '/showcases/auth/session' },
			{ label: 'Security', href: '/showcases/auth/security' },
		],
	},
	{
		href: '/showcases/ai',
		icon: 'i-lucide-bot',
		title: 'AI',
		description: 'AI assistant with Vercel AI SDK and Groq',
		sublinks: [
			{ label: 'Connection', href: '/showcases/ai/connection' },
			{ label: 'Chat', href: '/showcases/ai/chat' },
			{ label: 'Streaming', href: '/showcases/ai/streaming' },
			{
				label: 'Retrieval',
				href: '/showcases/ai/retrieval',
				children: [
					{ label: 'Ingest', href: '/showcases/ai/retrieval/ingest' },
					{ label: 'Contextual', href: '/showcases/ai/retrieval/contextual' },
					{ label: 'Parent-Child', href: '/showcases/ai/retrieval/parent-child' },
					{ label: 'Graph', href: '/showcases/ai/retrieval/graph' },
					{ label: 'Chat', href: '/showcases/ai/retrieval/chat' },
				],
			},
		],
	},
	{
		href: '/showcases/analytics',
		icon: 'i-lucide-activity',
		title: 'Analytics',
		description: 'Privacy-first analytics — page views, user journeys, funnels, and real-time events',
		sublinks: [
			{ label: 'Overview', href: '/showcases/analytics/overview' },
			{ label: 'Journeys', href: '/showcases/analytics/journeys' },
			{ label: 'Funnels', href: '/showcases/analytics/funnels' },
			{ label: 'Live', href: '/showcases/analytics/live' },
			{ label: 'Privacy', href: '/showcases/analytics/privacy' },
			{ label: 'My Data', href: '/showcases/analytics/my-data' },
		],
	},
	{
		href: '/showcases/i18n',
		icon: 'i-lucide-languages',
		title: 'i18n',
		description: 'Translations, pluralization, formatting, and language switching',
	},
	{
		href: '/showcases/jobs',
		icon: 'i-lucide-clock',
		title: 'Jobs',
		description: 'Scheduled background jobs with execution logging and monitoring',
	},
	{
		href: '/showcases/notifications',
		icon: 'i-lucide-bell',
		title: 'Notifications',
		description: 'Multi-channel notifications — in-app SSE, email, Telegram, and Discord',
		sublinks: [
			{ label: 'Send', href: '/showcases/notifications/send' },
			{ label: 'Pipeline', href: '/showcases/notifications/pipeline' },
			{ label: 'Channels', href: '/showcases/notifications/channels' },
		],
	},
];
