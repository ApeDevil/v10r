/**
 * Showcase section registry — the in-page "showcase elements" that quick-search
 * can deep-link to (`/showcases/…#anchor`).
 *
 * Seeded from the `const sections = [...]` arrays already declared in the
 * showcase `+page.svelte` files (which drive `<NavSection>` and match the
 * `<section id="…">` anchors the section components already render). This is a
 * curated projection — extend it as more showcase pages gain `_sections`.
 */
export interface ShowcaseSection {
	/** Owning page, locale-bare (e.g. `/showcases/ui/menus`). */
	pageHref: string;
	/** Matches the `<section id="…">` anchor on the page. */
	anchorId: string;
	title: string;
	keywords?: string[];
}

export const showcaseSections: ShowcaseSection[] = [
	// UI / Menus
	{
		pageHref: '/showcases/ui/menus',
		anchorId: 'menu-command-palette',
		title: 'Command Palette',
		keywords: ['cmdk', 'search', 'quick search'],
	},
	{ pageHref: '/showcases/ui/menus', anchorId: 'menu-overflow', title: 'Overflow Menu' },
	{ pageHref: '/showcases/ui/menus', anchorId: 'menu-selection-bar', title: 'Selection Bar' },
	{ pageHref: '/showcases/ui/menus', anchorId: 'menu-context', title: 'Context Menu' },
	{ pageHref: '/showcases/ui/menus', anchorId: 'menu-menubar', title: 'Menu Bar' },

	// UI / Tokens
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-typography', title: 'Typography Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-spacing', title: 'Spacing Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-colors', title: 'Color Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-color-combos', title: 'Color Combos' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-z-index', title: 'Z-Index Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-surfaces', title: 'Surface Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-radius', title: 'Radius Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-shadows', title: 'Shadow Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-icons', title: 'Icon Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-breakpoints', title: 'Breakpoint Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-containers', title: 'Container Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-duration', title: 'Duration Tokens' },
	{ pageHref: '/showcases/ui/tokens', anchorId: 'tok-layout', title: 'Layout Tokens' },

	// UI / Tables
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-ledger', title: 'Ledger Table' },
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-manifest', title: 'Manifest Table' },
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-specimen', title: 'Specimen Table' },
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-observatory', title: 'Observatory Table' },
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-folio', title: 'Folio Table' },
	{ pageHref: '/showcases/ui/tables', anchorId: 'tbl-cartograph', title: 'Cartograph Table' },

	// UI / Decorative — Backgrounds
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-dot-pattern', title: 'Dot Pattern' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-grid-pattern', title: 'Grid Pattern' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-retro-grid', title: 'Retro Grid' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-gradient-blob', title: 'Gradient Blob' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-noise-texture', title: 'Noise Texture' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-radial-glow', title: 'Radial Glow' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-fade-mask', title: 'Fade Mask' },
	{ pageHref: '/showcases/ui/decorative/backgrounds', anchorId: 'bg-line-fill', title: 'Line Fill' },

	// UI / Decorative — Ornaments
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-geometric-mark', title: 'Geometric Mark' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-divider', title: 'Divider' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-asterism', title: 'Asterism' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-kamon', title: 'Kamon' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-flourish', title: 'Flourish' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-wave-divider', title: 'Wave Divider' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-corner-frame', title: 'Corner Frame' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-concentric-rings', title: 'Concentric Rings' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-tick-marks', title: 'Tick Marks' },
	{ pageHref: '/showcases/ui/decorative/ornaments', anchorId: 'dec-marquee', title: 'Marquee' },

	// Viz / Charts
	{ pageHref: '/showcases/viz/charts', anchorId: 'bar-chart', title: 'Bar Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'line-chart', title: 'Line Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'area-chart', title: 'Area Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'pie-chart', title: 'Pie Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'radar-chart', title: 'Radar Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'bubble-chart', title: 'Bubble Chart' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'sparkline', title: 'Sparkline' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'gauge', title: 'Gauge' },
	{ pageHref: '/showcases/viz/charts', anchorId: 'treemap', title: 'Treemap' },

	// Viz / Plots
	{ pageHref: '/showcases/viz/plots', anchorId: 'scatter-plot', title: 'Scatter Plot' },
	{ pageHref: '/showcases/viz/plots', anchorId: 'activity-heatmap', title: 'Activity Heatmap' },
	{ pageHref: '/showcases/viz/plots', anchorId: 'correlation-matrix', title: 'Correlation Matrix' },
	{ pageHref: '/showcases/viz/plots', anchorId: 'server-load', title: 'Server Load Plot' },

	// Viz / Graphs
	{ pageHref: '/showcases/viz/graphs', anchorId: 'network-graph', title: 'Network Graph' },
	{ pageHref: '/showcases/viz/graphs', anchorId: 'directed-graph', title: 'Directed Graph' },
	{ pageHref: '/showcases/viz/graphs', anchorId: 'tree-graph', title: 'Tree Graph' },
	{ pageHref: '/showcases/viz/graphs', anchorId: 'dag-graph', title: 'DAG Graph' },
	{ pageHref: '/showcases/viz/graphs', anchorId: 'sankey-diagram', title: 'Sankey Diagram' },
	{ pageHref: '/showcases/viz/graphs', anchorId: 'knowledge-graph', title: 'Knowledge Graph' },

	// Viz / Diagrams
	{ pageHref: '/showcases/viz/diagrams', anchorId: 'auth-flow', title: 'Auth Flow Diagram' },
	{ pageHref: '/showcases/viz/diagrams', anchorId: 'order-state', title: 'Order State Diagram' },
	{ pageHref: '/showcases/viz/diagrams', anchorId: 'cicd-pipeline', title: 'CI/CD Pipeline Diagram' },

	// Viz / Maps
	{ pageHref: '/showcases/viz/maps', anchorId: 'basic-map', title: 'Basic Map' },
	{ pageHref: '/showcases/viz/maps', anchorId: 'markers-popups', title: 'Map Markers & Popups' },
	{ pageHref: '/showcases/viz/maps', anchorId: 'choropleth', title: 'Choropleth Map' },

	// Toolkits / Image Kit
	{
		pageHref: '/showcases/toolkits/image-kit',
		anchorId: 'kit-metadata',
		title: 'Metadata Reader',
		keywords: ['image', 'ai', 'caption', 'alt text', 'keywords'],
	},
	{
		pageHref: '/showcases/toolkits/image-kit',
		anchorId: 'kit-crop',
		title: 'Frame Cropper',
		keywords: ['crop', 'aspect ratio', '16:9', '9:16', 'square', 'saliency'],
	},
	{
		pageHref: '/showcases/toolkits/image-kit',
		anchorId: 'kit-embed',
		title: 'Image Embedder',
		keywords: ['embedding', 'vector', 'rag', 'cosine', 'heatmap'],
	},

	// Pattern MCP
	{
		pageHref: '/showcases/mcp',
		anchorId: 'registry-dag',
		title: 'Pattern Dependency Graph',
		keywords: ['dag', 'depends_on', 'registry', 'patterns', 'emulate'],
	},
	{
		pageHref: '/showcases/mcp',
		anchorId: 'architecture',
		title: 'MCP Container Architecture',
		keywords: ['podman', 'container', 'stdio', 'sandbox', 'read-only'],
	},
	{
		pageHref: '/showcases/mcp',
		anchorId: 'tools-protocol',
		title: 'MCP Tools & Protocol',
		keywords: ['json-rpc', 'handshake', 'tools', 'mcp'],
	},

	// App Shell
	{ pageHref: '/showcases/shell/sidebar', anchorId: 'shell-sidebar-state', title: 'Sidebar State' },
	{ pageHref: '/showcases/shell/sidebar', anchorId: 'shell-sidebar-breakpoints', title: 'Sidebar Breakpoints' },
	{ pageHref: '/showcases/shell/sidebar', anchorId: 'shell-sidebar-navigation', title: 'Sidebar Navigation' },
	{
		pageHref: '/showcases/shell/errors',
		anchorId: 'shell-errors-boundary',
		title: 'Component Error Boundary',
		keywords: ['svelte:boundary', 'crash', 'fallback'],
	},
	{ pageHref: '/showcases/shell/errors', anchorId: 'shell-errors-variants', title: 'Error Variants' },
	{ pageHref: '/showcases/shell/errors', anchorId: 'shell-errors-routes', title: 'Error Routes' },
	{ pageHref: '/showcases/shell/style', anchorId: 'shell-style-theme', title: 'Theme Mode' },
	{
		pageHref: '/showcases/shell/style',
		anchorId: 'shell-style-randomizer',
		title: 'Style Randomizer',
		keywords: ['dice', 'roll', 'shuffle'],
	},
	{
		pageHref: '/showcases/shell/style',
		anchorId: 'shell-style-picker',
		title: 'Pick Your Style',
		keywords: ['palette', 'typography', 'radius', 'shape', 'custom palette'],
	},

	// UI / Layouts
	{ pageHref: '/showcases/ui/layouts', anchorId: 'layout', title: 'Layout Primitives' },
	{
		pageHref: '/showcases/ui/layouts',
		anchorId: 'elevation',
		title: 'Surface Elevation',
		keywords: ['rim', 'glow', 'grain', 'tonal', 'surface'],
	},

	// UI / Workbench
	{ pageHref: '/showcases/ui/workbench', anchorId: 'workbench-dock', title: 'Interactive Dock' },
	{ pageHref: '/showcases/ui/workbench', anchorId: 'workbench-features', title: 'Workbench Features' },

	// UI / Splits
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-horizontal', title: 'Horizontal Layout' },
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-vertical', title: 'Vertical Layout' },
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-three-pane', title: 'Three-Pane Layout' },
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-persistent', title: 'Persistent Layout' },
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-collapsible', title: 'Collapsible Pane' },
	{ pageHref: '/showcases/ui/splits/resizable', anchorId: 'splits-resizable-minimal', title: 'Minimal Divider' },
	{ pageHref: '/showcases/ui/splits/reorderable', anchorId: 'splits-reorderable-basic', title: 'Basic Reorderable' },
	{
		pageHref: '/showcases/ui/splits/reorderable',
		anchorId: 'splits-reorderable-collapsible',
		title: 'Reorderable + Collapsible',
	},
	{
		pageHref: '/showcases/ui/splits/reorderable',
		anchorId: 'splits-reorderable-persistent',
		title: 'Persistent Pane Layout',
	},
	{ pageHref: '/showcases/ui/splits/reorderable', anchorId: 'splits-reorderable-vertical', title: 'Vertical Panes' },
	{ pageHref: '/showcases/ui/splits/reorderable', anchorId: 'splits-reorderable-props', title: 'Pane Props' },
	{
		pageHref: '/showcases/ui/splits/reorderable',
		anchorId: 'splits-reorderable-a11y',
		title: 'Pane Accessibility',
		keywords: ['keyboard', 'screen reader', 'motion'],
	},

	// i18n
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-switcher', title: 'Language Switcher' },
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-messages', title: 'Translated Messages' },
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-pluralization', title: 'Pluralization' },
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-formatting', title: 'Date & Number Formatting' },
	{
		pageHref: '/showcases/i18n',
		anchorId: 'i18n-content-translation',
		title: 'Content Translation (Database)',
		keywords: ['jsonb', 'db', 'content i18n'],
	},
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-error-codes', title: 'Error Codes' },
	{ pageHref: '/showcases/i18n', anchorId: 'i18n-type-safety', title: 'Type Safety' },

	// Abuse
	{ pageHref: '/showcases/abuse/captcha', anchorId: 'captcha-mode', title: 'Captcha Mode' },
	{ pageHref: '/showcases/abuse/captcha', anchorId: 'captcha-config', title: 'Captcha Config' },
	{ pageHref: '/showcases/abuse/captcha', anchorId: 'captcha-demo', title: 'Captcha Demo' },
	{ pageHref: '/showcases/abuse/captcha', anchorId: 'captcha-surfaces', title: 'Captcha Surfaces' },
	{ pageHref: '/showcases/abuse/honeypot', anchorId: 'honeypot-field', title: 'Honeypot Field' },
	{ pageHref: '/showcases/abuse/honeypot', anchorId: 'honeypot-timing', title: 'Honeypot Timing' },
	{ pageHref: '/showcases/abuse/honeypot', anchorId: 'honeypot-surfaces', title: 'Honeypot Surfaces' },
	{ pageHref: '/showcases/abuse/ai-budget', anchorId: 'budget-cap', title: 'AI Budget Cap' },
	{ pageHref: '/showcases/abuse/ai-budget', anchorId: 'budget-usage', title: 'AI Budget Usage' },

	// Jobs
	{ pageHref: '/showcases/jobs', anchorId: 'jobs-how', title: 'How Jobs Work' },
	{ pageHref: '/showcases/jobs', anchorId: 'jobs-registered', title: 'Registered Jobs' },
	{ pageHref: '/showcases/jobs', anchorId: 'jobs-recent', title: 'Recent Job Runs' },
	{ pageHref: '/showcases/jobs', anchorId: 'jobs-files', title: 'Job Files' },

	// Notifications
	{ pageHref: '/showcases/notifications/channels', anchorId: 'channels-providers', title: 'Channel Providers' },
	{ pageHref: '/showcases/notifications/channels', anchorId: 'channels-user', title: 'User Channel Preferences' },
	{ pageHref: '/showcases/notifications/channels', anchorId: 'channels-system', title: 'System Channels' },
	{ pageHref: '/showcases/notifications/channels', anchorId: 'channels-files', title: 'Channel Files' },
	{
		pageHref: '/showcases/notifications/pipeline',
		anchorId: 'pipeline-sse',
		title: 'SSE Live Stream',
		keywords: ['sse', 'streaming', 'realtime'],
	},
	{ pageHref: '/showcases/notifications/pipeline', anchorId: 'pipeline-deliveries', title: 'Recent Deliveries' },
	{ pageHref: '/showcases/notifications/send', anchorId: 'send-quick', title: 'Quick Send' },
	{ pageHref: '/showcases/notifications/send', anchorId: 'send-custom', title: 'Custom Notification' },

	// Auth
	{ pageHref: '/showcases/auth/authn', anchorId: 'authn-signin', title: 'Sandbox Sign-In' },
	{ pageHref: '/showcases/auth/authn', anchorId: 'authn-flow', title: 'Authentication Flow' },
	{ pageHref: '/showcases/auth/authn', anchorId: 'authn-middleware', title: 'Auth Middleware' },
	{ pageHref: '/showcases/auth/authz', anchorId: 'authz-sim', title: 'Permission Simulator' },
	{ pageHref: '/showcases/auth/authz', anchorId: 'authz-matrix', title: 'Permission Matrix' },
	{ pageHref: '/showcases/auth/authz', anchorId: 'authz-guards', title: 'Route Guards' },
	{ pageHref: '/showcases/auth/users', anchorId: 'users-table', title: 'User Table' },
	{ pageHref: '/showcases/auth/users', anchorId: 'users-audit', title: 'Audit Log' },
	{ pageHref: '/showcases/auth/users', anchorId: 'users-erd', title: 'User ERD & Cascades' },

	// PWA
	{ pageHref: '/showcases/pwa', anchorId: 'pwa-install', title: 'Install State' },
	{ pageHref: '/showcases/pwa', anchorId: 'pwa-policy', title: 'PWA Policy' },
	{ pageHref: '/showcases/pwa', anchorId: 'pwa-update', title: 'Service Worker Update' },

	// DB / Relational connection
	{ pageHref: '/showcases/db/relational/connection', anchorId: 'rel-conn-status', title: 'Connection Status' },
	{ pageHref: '/showcases/db/relational/connection', anchorId: 'rel-conn-db-info', title: 'Database Info' },
	{ pageHref: '/showcases/db/relational/connection', anchorId: 'rel-conn-latency', title: 'Connection Latency' },

	// Forms / Settings
	{ pageHref: '/showcases/forms/basics/settings', anchorId: 'settings-profile', title: 'Profile Settings' },
	{ pageHref: '/showcases/forms/basics/settings', anchorId: 'settings-preferences', title: 'Preference Settings' },
	{
		pageHref: '/showcases/forms/basics/settings',
		anchorId: 'settings-notifications',
		title: 'Notification Settings',
	},

	// Admin
	{ pageHref: '/showcases/admin', anchorId: 'admin-guarantees', title: 'Admin Guarantees' },
	{ pageHref: '/showcases/admin', anchorId: 'admin-capabilities', title: 'Admin Capabilities' },

	// Privacy
	{
		pageHref: '/showcases/privacy',
		anchorId: 'privacy-controller',
		title: 'Data Controller',
		keywords: ['gdpr', 'art. 13', 'controller'],
	},
	{ pageHref: '/showcases/privacy', anchorId: 'privacy-principles', title: 'Privacy Principles' },
	{ pageHref: '/showcases/privacy', anchorId: 'privacy-subpages', title: 'Privacy Detail Pages' },
	{ pageHref: '/showcases/privacy/retention', anchorId: 'retention-table', title: 'Per-table Retention' },
	{ pageHref: '/showcases/privacy/retention', anchorId: 'retention-cron', title: 'Retention Cron Status' },
];
