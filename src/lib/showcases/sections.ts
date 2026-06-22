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
];
