interface ShowcaseCard {
	href: string;
	icon: string;
	title: string;
	description: string;
	sublinks?: { label: string; href: string }[];
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
			{ label: 'Components', href: '/showcases/ui/components' },
			{ label: 'Layouts', href: '/showcases/ui/layouts' },
			{ label: 'Tables', href: '/showcases/ui/tables' },
			{ label: 'Panes', href: '/showcases/ui/panes' },
			{ label: 'Decorative', href: '/showcases/ui/decorative' },
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
			{ label: 'Basics', href: '/showcases/forms/basics' },
			{ label: 'Validation', href: '/showcases/forms/validation' },
			{ label: 'Patterns', href: '/showcases/forms/patterns' },
			{ label: 'Advanced', href: '/showcases/forms/advanced' },
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
			{ label: 'Relational', href: '/showcases/db/relational' },
			{ label: 'Graph', href: '/showcases/db/graph' },
			{ label: 'Storage', href: '/showcases/db/storage' },
			{ label: 'Cache', href: '/showcases/db/cache' },
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
			{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
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
