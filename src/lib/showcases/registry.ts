/**
 * Showcase registry — the single source of truth for the showcase card tree.
 *
 * Lives in `$lib` (not the route tree) so non-route consumers — notably the
 * search index adapters in `$lib/server/search/` — can read it without a
 * `$lib → routes` back-edge. The showcase routes re-export this plus their
 * route-only navigation helpers from `../showcases`.
 *
 * All human-visible copy (titles, descriptions, sublink labels) is stored as
 * Paraglide message-function references (`LabelFn`, the `nav.ts` convention) —
 * consumers call `card.title()` at render time to pick up the current locale.
 * Imports are RELATIVE (not `$lib`) so the module stays resolvable under bare
 * Bun scripts (`catalog-projection.ts` → `scripts/db/catalog-sync.ts`), where
 * Paraglide falls back to the base locale (English).
 */
import type { LabelFn } from '../nav/types';
import * as m from '../paraglide/messages.js';

/** A doc link surfaced by the `ShowcaseDocs` composite (see `resolve-docs.ts`).
 *  Labels stay plain strings — docs are English-only and the docs gate pins them. */
export interface ShowcaseDocLink {
	href: string;
	label?: string;
}

export interface ShowcaseSublink {
	label: LabelFn;
	href: string;
	children?: ShowcaseSublink[];
	/** In-app `/docs/...` pages that explain this sublink's pattern. */
	docs?: ShowcaseDocLink[];
}

/** Top-level capability grouping of the showcase cards (hub sections, home grid).
 *  Named "domain" — `sections.ts` already owns "section" for in-page anchors, and
 *  the catalog projection's `ResourceKind` uses "domain" for exactly this level. */
export type ShowcaseDomainId = 'frontend' | 'backend' | 'data' | 'ai' | 'security';

export interface ShowcaseDomainMeta {
	id: ShowcaseDomainId;
	label: LabelFn;
}

/** Ordered domain list — hub section order and home-grid grouping follow this. */
export const showcaseDomains: ShowcaseDomainMeta[] = [
	{ id: 'frontend', label: m.showcase_domain_frontend },
	{ id: 'backend', label: m.showcase_domain_backend },
	{ id: 'data', label: m.showcase_domain_data },
	{ id: 'ai', label: m.showcase_domain_ai },
	{ id: 'security', label: m.showcase_domain_security },
];

export interface ShowcaseCard {
	href: string;
	icon: string;
	title: LabelFn;
	description: LabelFn;
	/** Breadcrumb label when it differs from `title` (falls back to `title`). */
	breadcrumbLabel?: LabelFn;
	/** Tab-bar aria label (falls back to `title`). */
	ariaLabel?: LabelFn;
	domain: ShowcaseDomainId;
	sublinks?: ShowcaseSublink[];
	/** In-app `/docs/...` pages that explain this card's pattern. */
	docs?: ShowcaseDocLink[];
}

export const showcases: ShowcaseCard[] = [
	// ── frontend ──────────────────────────────────────────────────────────
	{
		href: '/showcases/shell',
		icon: 'i-lucide-layout',
		title: m.showcase_shell_title,
		description: m.showcase_shell_description,
		breadcrumbLabel: m.showcase_shell_breadcrumb,
		ariaLabel: m.showcase_shell_aria,
		domain: 'frontend',
		docs: [{ href: '/docs/blueprint/app-shell/sidebar', label: 'Sidebar' }],
		sublinks: [
			{ label: m.showcase_shell_tab_sidebar, href: '/showcases/shell/sidebar' },
			{
				label: m.showcase_shell_tab_style,
				href: '/showcases/shell/style',
				docs: [
					{ href: '/docs/foundation/style', label: 'Style Randomization' },
					{ href: '/docs/blueprint/visual-identity-architecture', label: 'Visual Identity' },
				],
			},
			{
				label: m.showcase_shell_tab_toasts,
				href: '/showcases/shell/toasts',
				docs: [{ href: '/docs/blueprint/app-shell/toast', label: 'Toasts' }],
			},
			{
				label: m.showcase_shell_tab_modals,
				href: '/showcases/shell/modals',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
			},
			{
				label: m.showcase_shell_tab_shortcuts,
				href: '/showcases/shell/shortcuts',
				docs: [{ href: '/docs/blueprint/app-shell/keyboard-shortcuts', label: 'Keyboard Shortcuts' }],
			},
			{
				label: m.showcase_shell_tab_errors,
				href: '/showcases/shell/errors',
				docs: [{ href: '/docs/blueprint/error-handling', label: 'Error Handling' }],
			},
			{
				label: m.showcase_shell_tab_session,
				href: '/showcases/shell/session',
				docs: [{ href: '/docs/blueprint/app-shell/session-lifecycle', label: 'Session Lifecycle' }],
			},
		],
	},
	{
		href: '/showcases/ui',
		icon: 'i-lucide-palette',
		title: m.showcase_ui_title,
		description: m.showcase_ui_description,
		breadcrumbLabel: m.showcase_ui_breadcrumb,
		ariaLabel: m.showcase_ui_aria,
		domain: 'frontend',
		docs: [
			{ href: '/docs/blueprint/design/components', label: 'Components' },
			{ href: '/docs/stack/bits-ui', label: 'Bits UI' },
		],
		sublinks: [
			{
				label: m.showcase_ui_tab_components,
				href: '/showcases/ui/components',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
				children: [
					{ label: m.showcase_ui_tab_components_primitives, href: '/showcases/ui/components/primitives' },
					{ label: m.showcase_ui_tab_components_composites, href: '/showcases/ui/components/composites' },
				],
			},
			{
				label: m.showcase_ui_tab_layouts,
				href: '/showcases/ui/layouts',
				docs: [
					{ href: '/docs/blueprint/design/tokens', label: 'Tokens' },
					{ href: '/docs/blueprint/design/components', label: 'Components' },
				],
			},
			{
				label: m.showcase_ui_tab_tables,
				href: '/showcases/ui/tables',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
			},
			{
				label: m.showcase_ui_tab_menus,
				href: '/showcases/ui/menus',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
			},
			{
				label: m.showcase_ui_tab_splits,
				href: '/showcases/ui/splits',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
				children: [
					{ label: m.showcase_ui_tab_splits_resizable, href: '/showcases/ui/splits/resizable' },
					{ label: m.showcase_ui_tab_splits_reorderable, href: '/showcases/ui/splits/reorderable' },
				],
			},
			{
				label: m.showcase_ui_tab_workbench,
				href: '/showcases/ui/workbench',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
			},
			{
				label: m.showcase_ui_tab_decorative,
				href: '/showcases/ui/decorative',
				docs: [{ href: '/docs/blueprint/design/components', label: 'Components' }],
				children: [
					{ label: m.showcase_ui_tab_decorative_ornaments, href: '/showcases/ui/decorative/ornaments' },
					{ label: m.showcase_ui_tab_decorative_backgrounds, href: '/showcases/ui/decorative/backgrounds' },
				],
			},
			{
				label: m.showcase_ui_tab_typography,
				href: '/showcases/ui/typography',
				docs: [{ href: '/docs/blueprint/design/tokens', label: 'Tokens' }],
			},
			{
				label: m.showcase_ui_tab_tokens,
				href: '/showcases/ui/tokens',
				docs: [{ href: '/docs/blueprint/design/tokens', label: 'Tokens' }],
			},
		],
	},
	{
		href: '/showcases/forms',
		icon: 'i-lucide-text-cursor-input',
		title: m.showcase_forms_title,
		description: m.showcase_forms_description,
		ariaLabel: m.showcase_forms_aria,
		domain: 'frontend',
		docs: [
			{ href: '/docs/blueprint/forms', label: 'Forms' },
			{ href: '/docs/stack/superforms', label: 'Superforms' },
		],
		sublinks: [
			{
				label: m.showcase_forms_tab_basics,
				href: '/showcases/forms/basics',
				children: [
					{
						label: m.showcase_forms_tab_basics_contact,
						href: '/showcases/forms/basics/contact',
						docs: [{ href: '/docs/blueprint/forms', label: 'Forms' }],
					},
					{
						label: m.showcase_forms_tab_basics_settings,
						href: '/showcases/forms/basics/settings',
						docs: [{ href: '/docs/blueprint/forms', label: 'Forms' }],
					},
				],
			},
			{
				label: m.showcase_forms_tab_validation,
				href: '/showcases/forms/validation',
				children: [
					{ label: m.showcase_forms_tab_validation_realtime, href: '/showcases/forms/validation/realtime' },
					{ label: m.showcase_forms_tab_validation_async, href: '/showcases/forms/validation/async' },
					{ label: m.showcase_forms_tab_validation_server, href: '/showcases/forms/validation/server' },
				],
				docs: [
					{ href: '/docs/blueprint/forms', label: 'Forms' },
					{ href: '/docs/stack/valibot', label: 'Valibot' },
				],
			},
			{
				label: m.showcase_forms_tab_patterns,
				href: '/showcases/forms/patterns',
				children: [
					{ label: m.showcase_forms_tab_patterns_wizard, href: '/showcases/forms/patterns/wizard' },
					{ label: m.showcase_forms_tab_patterns_dynamic, href: '/showcases/forms/patterns/dynamic' },
					{ label: m.showcase_forms_tab_patterns_dependent, href: '/showcases/forms/patterns/dependent' },
				],
				docs: [{ href: '/docs/blueprint/forms', label: 'Forms' }],
			},
			{
				label: m.showcase_forms_tab_advanced,
				href: '/showcases/forms/advanced',
				children: [
					{ label: m.showcase_forms_tab_advanced_confirm, href: '/showcases/forms/advanced/confirm' },
					{ label: m.showcase_forms_tab_advanced_reset, href: '/showcases/forms/advanced/reset' },
					{ label: m.showcase_forms_tab_advanced_edit, href: '/showcases/forms/advanced/edit' },
				],
				docs: [{ href: '/docs/blueprint/forms', label: 'Forms' }],
			},
			{
				label: m.showcase_forms_tab_auth,
				href: '/showcases/forms/auth',
				docs: [
					{ href: '/docs/blueprint/auth', label: 'Auth' },
					{ href: '/docs/blueprint/forms', label: 'Forms' },
				],
			},
		],
	},
	{
		href: '/showcases/viz',
		icon: 'i-lucide-bar-chart-3',
		title: m.showcase_viz_title,
		description: m.showcase_viz_description,
		breadcrumbLabel: m.showcase_viz_breadcrumb,
		domain: 'frontend',
		docs: [{ href: '/docs/stack/viz', label: 'Data Viz' }],
		sublinks: [
			{ label: m.showcase_viz_tab_charts, href: '/showcases/viz/charts' },
			{ label: m.showcase_viz_tab_plots, href: '/showcases/viz/plots' },
			{ label: m.showcase_viz_tab_diagrams, href: '/showcases/viz/diagrams' },
			{ label: m.showcase_viz_tab_graphs, href: '/showcases/viz/graphs' },
			{ label: m.showcase_viz_tab_maps, href: '/showcases/viz/maps' },
		],
	},
	{
		href: '/showcases/3d',
		icon: 'i-lucide-box',
		title: m.showcase_3d_title,
		description: m.showcase_3d_description,
		domain: 'frontend',
		docs: [{ href: '/docs/blueprint/3d/3d-integration', label: '3D Integration' }],
		sublinks: [
			{
				label: m.showcase_3d_tab_static_scene,
				href: '/showcases/3d/static-scene',
				docs: [
					{ href: '/docs/blueprint/3d/3d-integration', label: '3D Integration' },
					{ href: '/docs/blueprint/3d/3d-quick-reference', label: '3D Quick Reference' },
				],
			},
			{
				label: m.showcase_3d_tab_animated_scene,
				href: '/showcases/3d/animated-scene',
				docs: [
					{ href: '/docs/blueprint/3d/3d-integration', label: '3D Integration' },
					{ href: '/docs/blueprint/3d/3d-quick-reference', label: '3D Quick Reference' },
				],
			},
		],
	},
	{
		href: '/showcases/i18n',
		icon: 'i-lucide-languages',
		title: m.showcase_i18n_title,
		description: m.showcase_i18n_description,
		domain: 'frontend',
		docs: [
			{ href: '/docs/blueprint/i18n', label: 'i18n' },
			{ href: '/docs/stack/paraglide', label: 'Paraglide' },
		],
	},
	{
		href: '/showcases/pwa',
		icon: 'i-lucide-smartphone',
		title: m.showcase_pwa_title,
		description: m.showcase_pwa_description,
		domain: 'frontend',
		docs: [
			{ href: '/docs/blueprint/pwa', label: 'PWA' },
			{ href: '/docs/stack/pwa', label: 'PWA Capabilities' },
		],
	},
	// ── backend ───────────────────────────────────────────────────────────
	{
		href: '/showcases/cycle',
		icon: 'i-lucide-orbit',
		title: m.showcase_cycle_title,
		description: m.showcase_cycle_description,
		breadcrumbLabel: m.showcase_cycle_breadcrumb,
		ariaLabel: m.showcase_cycle_aria,
		domain: 'backend',
		docs: [{ href: '/docs/blueprint/middleware', label: 'Middleware' }],
		sublinks: [
			{
				label: m.showcase_cycle_tab_form,
				href: '/showcases/cycle/form',
				docs: [
					{ href: '/docs/blueprint/middleware', label: 'Middleware' },
					{ href: '/docs/blueprint/forms', label: 'Forms' },
				],
			},
			{
				label: m.showcase_cycle_tab_api,
				href: '/showcases/cycle/api',
				docs: [
					{ href: '/docs/blueprint/middleware', label: 'Middleware' },
					{ href: '/docs/blueprint/api', label: 'API' },
				],
			},
			{
				label: m.showcase_cycle_tab_ai,
				href: '/showcases/cycle/ai',
				docs: [
					{ href: '/docs/blueprint/ai/layered-rag', label: 'Layered RAG' },
					{ href: '/docs/blueprint/ai/graph-rag', label: 'Graph RAG' },
				],
			},
		],
	},
	{
		href: '/showcases/jobs',
		icon: 'i-lucide-clock',
		title: m.showcase_jobs_title,
		description: m.showcase_jobs_description,
		domain: 'backend',
		docs: [{ href: '/docs/blueprint/architecture/jobs', label: 'Jobs' }],
	},
	{
		href: '/showcases/notifications',
		icon: 'i-lucide-bell',
		title: m.showcase_notifications_title,
		description: m.showcase_notifications_description,
		ariaLabel: m.showcase_notifications_aria,
		domain: 'backend',
		docs: [{ href: '/docs/blueprint/notifications/routing', label: 'Notification Routing' }],
		sublinks: [
			{ label: m.showcase_notifications_tab_send, href: '/showcases/notifications/send' },
			{ label: m.showcase_notifications_tab_pipeline, href: '/showcases/notifications/pipeline' },
			{
				label: m.showcase_notifications_tab_channels,
				href: '/showcases/notifications/channels',
				docs: [{ href: '/docs/blueprint/notifications/channels', label: 'Channels' }],
			},
		],
	},
	// ── data ──────────────────────────────────────────────────────────────
	{
		href: '/showcases/db',
		icon: 'i-lucide-server',
		title: m.showcase_db_title,
		description: m.showcase_db_description,
		breadcrumbLabel: m.showcase_db_breadcrumb,
		ariaLabel: m.showcase_db_aria,
		domain: 'data',
		docs: [{ href: '/docs/blueprint/db/relational', label: 'Relational DB' }],
		sublinks: [
			{
				label: m.showcase_db_tab_relational,
				href: '/showcases/db/relational',
				children: [
					{ label: m.showcase_db_tab_relational_connection, href: '/showcases/db/relational/connection' },
					{ label: m.showcase_db_tab_relational_types, href: '/showcases/db/relational/types' },
					{ label: m.showcase_db_tab_relational_mutability, href: '/showcases/db/relational/mutability' },
				],
				docs: [
					{ href: '/docs/blueprint/db/relational', label: 'Relational DB' },
					{ href: '/docs/stack/postgres', label: 'PostgreSQL' },
				],
			},
			{
				label: m.showcase_db_tab_graph,
				href: '/showcases/db/graph',
				children: [
					{ label: m.showcase_db_tab_graph_connection, href: '/showcases/db/graph/connection' },
					{ label: m.showcase_db_tab_graph_model, href: '/showcases/db/graph/model' },
					{ label: m.showcase_db_tab_graph_traversal, href: '/showcases/db/graph/traversal' },
				],
				docs: [
					{ href: '/docs/blueprint/db/graph', label: 'Graph DB' },
					{ href: '/docs/stack/neo4j', label: 'Neo4j' },
				],
			},
			{
				label: m.showcase_db_tab_storage,
				href: '/showcases/db/storage',
				children: [
					{ label: m.showcase_db_tab_storage_connection, href: '/showcases/db/storage/connection' },
					{ label: m.showcase_db_tab_storage_objects, href: '/showcases/db/storage/objects' },
					{ label: m.showcase_db_tab_storage_transfer, href: '/showcases/db/storage/transfer' },
				],
				docs: [{ href: '/docs/stack/r2', label: 'Cloudflare R2' }],
			},
			{
				label: m.showcase_db_tab_cache,
				href: '/showcases/db/cache',
				children: [
					{ label: m.showcase_db_tab_cache_connection, href: '/showcases/db/cache/connection' },
					{ label: m.showcase_db_tab_cache_patterns, href: '/showcases/db/cache/patterns' },
					{ label: m.showcase_db_tab_cache_ephemeral, href: '/showcases/db/cache/ephemeral' },
				],
				docs: [{ href: '/docs/stack/redis', label: 'Redis' }],
			},
		],
	},
	{
		href: '/showcases/analytics',
		icon: 'i-lucide-activity',
		title: m.showcase_analytics_title,
		description: m.showcase_analytics_description,
		ariaLabel: m.showcase_analytics_aria,
		domain: 'data',
		docs: [{ href: '/docs/blueprint/analytics/activation', label: 'Analytics' }],
		sublinks: [
			{ label: m.showcase_analytics_tab_overview, href: '/showcases/analytics/overview' },
			{ label: m.showcase_analytics_tab_journeys, href: '/showcases/analytics/journeys' },
			{ label: m.showcase_analytics_tab_funnels, href: '/showcases/analytics/funnels' },
			{ label: m.showcase_analytics_tab_live, href: '/showcases/analytics/live' },
			{
				label: m.showcase_analytics_tab_privacy,
				href: '/showcases/analytics/privacy',
				docs: [
					{ href: '/docs/blueprint/analytics/legitimate-interest', label: 'Legal basis' },
					{ href: '/docs/stack/gdpr', label: 'GDPR' },
				],
			},
			{
				label: m.showcase_analytics_tab_my_data,
				href: '/showcases/analytics/my-data',
				docs: [
					{ href: '/docs/stack/gdpr', label: 'GDPR' },
					{ href: '/docs/blueprint/analytics/two-lane-model', label: 'Two lanes' },
				],
			},
		],
	},
	// ── ai ────────────────────────────────────────────────────────────────
	{
		href: '/showcases/ai',
		icon: 'i-lucide-bot',
		title: m.showcase_ai_title,
		description: m.showcase_ai_description,
		ariaLabel: m.showcase_ai_aria,
		domain: 'ai',
		docs: [{ href: '/docs/blueprint/ai/layered-rag', label: 'Layered RAG' }],
		sublinks: [
			{
				label: m.showcase_ai_tab_chat,
				href: '/showcases/ai/chat',
				docs: [
					{ href: '/docs/blueprint/ai/surfaces', label: 'AI Surfaces' },
					{ href: '/docs/stack/ai-sdk', label: 'AI SDK' },
				],
			},
			{
				label: m.showcase_ai_tab_image_metadata,
				href: '/showcases/ai/image-metadata',
				docs: [{ href: '/docs/blueprint/ai/image-metadata', label: 'Image Metadata' }],
			},
			{
				label: m.showcase_ai_tab_retrieval,
				href: '/showcases/ai/retrieval',
				children: [
					{ label: m.showcase_ai_tab_retrieval_overview, href: '/showcases/ai/retrieval' },
					{
						label: m.showcase_ai_tab_retrieval_ingest,
						href: '/showcases/ai/retrieval/ingest',
						docs: [{ href: '/docs/blueprint/ai/knowledge-base', label: 'Knowledge Base' }],
					},
					{
						label: m.showcase_ai_tab_retrieval_rag_chat,
						href: '/showcases/ai/retrieval/rag-chat',
						docs: [
							{ href: '/docs/blueprint/ai/layered-rag', label: 'Layered RAG' },
							{ href: '/docs/blueprint/ai/nrag-observability', label: 'nRAG Observability' },
						],
					},
					{
						label: m.showcase_ai_tab_retrieval_explorer,
						href: '/showcases/ai/retrieval/explorer',
						docs: [
							{ href: '/docs/blueprint/ai/knowledge-base', label: 'Knowledge Base' },
							{ href: '/docs/blueprint/ai/graph-rag', label: 'Graph RAG' },
						],
					},
				],
				docs: [
					{ href: '/docs/blueprint/ai/layered-rag', label: 'Layered RAG' },
					{ href: '/docs/blueprint/ai/knowledge-base', label: 'Knowledge Base' },
				],
			},
		],
	},
	{
		href: '/showcases/toolkits',
		icon: 'i-lucide-wrench',
		title: m.showcase_toolkits_title,
		description: m.showcase_toolkits_description,
		ariaLabel: m.showcase_toolkits_aria,
		domain: 'ai',
		docs: [{ href: '/docs/blueprint/ai/image-kit', label: 'Image Kit' }],
		sublinks: [{ label: m.showcase_toolkits_tab_image_kit, href: '/showcases/toolkits/image-kit' }],
	},
	{
		href: '/showcases/mcp',
		icon: 'i-lucide-network',
		title: m.showcase_mcp_title,
		description: m.showcase_mcp_description,
		domain: 'ai',
		docs: [
			{ href: '/docs/blueprint/architecture/pattern-mcp', label: 'Pattern MCP' },
			{ href: '/docs/blueprint/architecture/hosted-mcp', label: 'Hosted MCP' },
		],
	},
	// ── security ──────────────────────────────────────────────────────────
	{
		href: '/showcases/auth',
		icon: 'i-lucide-lock',
		title: m.showcase_auth_title,
		description: m.showcase_auth_description,
		ariaLabel: m.showcase_auth_aria,
		domain: 'security',
		docs: [{ href: '/docs/blueprint/auth', label: 'Auth' }],
		sublinks: [
			{
				label: m.showcase_auth_tab_authn,
				href: '/showcases/auth/authn',
				docs: [
					{ href: '/docs/blueprint/auth', label: 'Auth' },
					{ href: '/docs/stack/better-auth', label: 'Better Auth' },
				],
			},
			{
				label: m.showcase_auth_tab_authz,
				href: '/showcases/auth/authz',
				docs: [
					{ href: '/docs/blueprint/auth', label: 'Auth' },
					{ href: '/docs/stack/better-auth', label: 'Better Auth' },
				],
			},
			{
				label: m.showcase_auth_tab_users,
				href: '/showcases/auth/users',
				docs: [
					{ href: '/docs/blueprint/auth', label: 'Auth' },
					{ href: '/docs/stack/better-auth', label: 'Better Auth' },
				],
			},
		],
	},
	{
		href: '/showcases/abuse',
		icon: 'i-lucide-shield-alert',
		title: m.showcase_abuse_title,
		description: m.showcase_abuse_description,
		breadcrumbLabel: m.showcase_abuse_breadcrumb,
		ariaLabel: m.showcase_abuse_aria,
		domain: 'security',
		docs: [
			{ href: '/docs/blueprint/abuse/rate-limits', label: 'Rate Limits' },
			{ href: '/docs/blueprint/abuse/captcha', label: 'Captcha' },
		],
		sublinks: [
			{ label: m.showcase_abuse_tab_overview, href: '/showcases/abuse' },
			{
				label: m.showcase_abuse_tab_captcha,
				href: '/showcases/abuse/captcha',
				docs: [{ href: '/docs/blueprint/abuse/captcha', label: 'Captcha' }],
			},
			{
				label: m.showcase_abuse_tab_honeypot,
				href: '/showcases/abuse/honeypot',
				docs: [{ href: '/docs/blueprint/abuse/honeypot', label: 'Honeypot' }],
			},
			{
				label: m.showcase_abuse_tab_rate_limits,
				href: '/showcases/abuse/rate-limits',
				docs: [{ href: '/docs/blueprint/abuse/rate-limits', label: 'Rate Limits' }],
			},
			{
				label: m.showcase_abuse_tab_ai_budget,
				href: '/showcases/abuse/ai-budget',
				docs: [{ href: '/docs/blueprint/abuse/ai-budget', label: 'AI Budget' }],
			},
		],
	},
	{
		href: '/showcases/privacy',
		icon: 'i-lucide-shield-check',
		title: m.showcase_privacy_title,
		description: m.showcase_privacy_description,
		ariaLabel: m.showcase_privacy_aria,
		domain: 'security',
		docs: [
			{ href: '/docs/stack/gdpr', label: 'GDPR' },
			{ href: '/docs/foundation/user-data', label: 'User Data' },
		],
		sublinks: [
			{ label: m.showcase_privacy_tab_overview, href: '/showcases/privacy' },
			{ label: m.showcase_privacy_tab_data, href: '/showcases/privacy/data' },
			{
				label: m.showcase_privacy_tab_retention,
				href: '/showcases/privacy/retention',
				docs: [
					{ href: '/docs/blueprint/architecture/jobs', label: 'Jobs' },
					{ href: '/docs/stack/gdpr', label: 'GDPR' },
				],
			},
			{
				label: m.showcase_privacy_tab_rights,
				href: '/showcases/privacy/rights',
				docs: [{ href: '/docs/stack/gdpr', label: 'GDPR' }],
			},
			{
				label: m.showcase_privacy_tab_cookies,
				href: '/showcases/privacy/cookies',
				docs: [{ href: '/docs/stack/gdpr', label: 'GDPR' }],
			},
		],
	},
	{
		href: '/showcases/admin',
		icon: 'i-lucide-shield',
		title: m.showcase_admin_title,
		description: m.showcase_admin_description,
		ariaLabel: m.showcase_admin_aria,
		domain: 'security',
		docs: [{ href: '/docs/foundation/user-data', label: 'User Data' }],
	},
];

/** Cards grouped by domain, in `showcaseDomains` order (registry array order within). */
export function groupByDomain(): { domain: ShowcaseDomainMeta; cards: ShowcaseCard[] }[] {
	return showcaseDomains.map((domain) => ({
		domain,
		cards: showcases.filter((card) => card.domain === domain.id),
	}));
}
