<script lang="ts">
	import { Accordion } from '$lib/components';
	import { fadeIn } from './fadeIn';
</script>

<!-- Inner snippets: Intelligence Layer detail -->
{#snippet agentsSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>archy</code> architecture & system design</li>
			<li><code>arty</code> aesthetic refinement & visual polish</li>
			<li><code>buny</code> Bun runtime & tooling</li>
			<li><code>daty</code> database schemas & data modeling</li>
			<li><code>docy</code> documentation & technical writing</li>
			<li><code>resy</code> technology research & evaluation</li>
			<li><code>scout</code> real-world usage research</li>
			<li><code>secy</code> security review & threat modeling</li>
			<li><code>svey</code> SvelteKit application patterns</li>
			<li><code>tray</code> debugging & error tracing</li>
			<li><code>uxy</code> UI/UX design & accessibility</li>
		</ul>
	</div>
{/snippet}

{#snippet skillsSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>svelte5-runes</code> <code>sveltekit</code> <code>unocss</code> <code>biome</code> — core framework</li>
			<li><code>drizzle</code> <code>db-relational</code> <code>db-graph</code> <code>db-files</code> — data layer</li>
			<li><code>better-auth</code> <code>security</code> — auth & security</li>
			<li><code>valibot-superforms</code> <code>design-system</code> — forms & design</li>
			<li><code>ai-tools</code> <code>3d</code> — AI & visualization</li>
		</ul>
	</div>
{/snippet}

{#snippet docsHubsSnippet()}
	<div class="structure-content">
		<p>Each directory has a README.md navigation hub — brief intro, then a topic table linking to specific files.</p>
		<ul>
			<li><code>docs/foundation/</code> core concepts & conventions</li>
			<li><code>docs/stack/</code> technology documentation per layer</li>
			<li><code>docs/blueprint/</code> architecture decisions</li>
			<li><code>docs/implementation/</code> build details</li>
			<li><code>docs/patterns/</code> reusable patterns</li>
			<li><code>docs/guides/</code> how-to guides</li>
		</ul>
	</div>
{/snippet}

<!-- Inner snippets: Structural Map detail -->
{#snippet routesSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>/app</code> main application</li>
			<li><code>/auth</code> authentication flows</li>
			<li><code>/showcases</code> feature demonstrations</li>
			<li><code>/docs</code> documentation viewer</li>
			<li><code>/desk</code> workspace</li>
			<li><code>/api</code> REST endpoints</li>
		</ul>
	</div>
{/snippet}

{#snippet serverSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>ai</code> <code>graph</code> <code>retrieval</code> — intelligence</li>
			<li><code>db</code> <code>cache</code> <code>store</code> — persistence</li>
			<li><code>auth</code> <code>notifications</code> — identity & messaging</li>
			<li><code>api</code> <code>platform</code> — external interfaces</li>
			<li><code>jobs</code> <code>analytics</code> — background & telemetry</li>
		</ul>
	</div>
{/snippet}

{#snippet componentsSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>primitives/</code> atomic UI elements (accordion, button, input...)</li>
			<li><code>composites/</code> assembled patterns (data-table, sidebar...)</li>
			<li><code>layout/</code> page structure (stack, grid, divider...)</li>
			<li><code>shell/</code> app chrome (nav, footer, theme)</li>
			<li><code>viz/</code> charts & 3D (lazy-loaded, excluded from barrel)</li>
		</ul>
	</div>
{/snippet}

{#snippet claudeSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>agents/</code> 11 specialized Claude Code agents</li>
			<li><code>skills/</code> 14 post-training knowledge modules</li>
			<li><code>memory/</code> persistent agent memory across sessions</li>
		</ul>
	</div>
{/snippet}

{#snippet documentationSnippet()}
	<div class="structure-content">
		<ul>
			<li><code>foundation/</code> core concepts & conventions</li>
			<li><code>stack/</code> per-technology documentation</li>
			<li><code>blueprint/</code> architecture decisions</li>
			<li><code>implementation/</code> build details</li>
			<li><code>patterns/</code> reusable patterns</li>
		</ul>
	</div>
{/snippet}

<!-- Outer snippets -->
{#snippet intelligenceContent()}
	<div class="structure-content">
		<p>Specialized Claude Code agents with custom prompts, skills, and persistent memory.</p>
		<Accordion
			items={[
				{ value: 'agents', title: 'Agents', content: agentsSnippet },
				{ value: 'skills', title: 'Skills', content: skillsSnippet },
				{ value: 'docs', title: 'Documentation Hubs', content: docsHubsSnippet },
			]}
			type="multiple"
			size="sm"
			variant="default"
			class="structure-inner"
		/>
	</div>
{/snippet}

{#snippet structuralContent()}
	<div class="structure-content">
		<Accordion
			items={[
				{ value: 'routes', title: 'Routes', content: routesSnippet },
				{ value: 'server', title: 'Server Modules', content: serverSnippet },
				{ value: 'components', title: 'Components', content: componentsSnippet },
				{ value: 'claude', title: 'AI Infrastructure', content: claudeSnippet },
				{ value: 'documentation', title: 'Documentation', content: documentationSnippet },
			]}
			type="multiple"
			size="sm"
			variant="default"
			class="structure-inner"
		/>
		<p class="structure-note">Multi-client core — domain modules serve UI form actions, AI tool calls, REST API, and background jobs through a single business-logic layer.</p>
	</div>
{/snippet}

<section class="structure" use:fadeIn>
	<header class="structure-header">
		<h2 class="structure-title">INTERNAL STRUCTURE</h2>
		<p class="structure-subtitle">Composition and organization of the living system</p>
	</header>

	<Accordion
		items={[
			{ value: 'intelligence', title: 'Intelligence Layer', content: intelligenceContent },
			{ value: 'structural', title: 'Structural Map', content: structuralContent },
		]}
		type="multiple"
		size="sm"
		variant="default"
	/>
</section>

<style>
	.structure {
		padding: var(--spacing-5) var(--spacing-fluid-3) var(--spacing-8);
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
	}

	/* Anchor all accordion elements to full width — prevents centering jump on open/close */
	.structure :global([data-accordion-root]),
	.structure :global([data-accordion-item]) {
		width: 100%;
		display: block;
	}

	.structure-header {
		text-align: center;
		margin-bottom: var(--spacing-7);
	}

	/* Level 1: Section title — widest tracking, largest size */
	.structure-title {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: var(--text-fluid-lg);
		letter-spacing: 0.25em;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2);
	}

	.structure-subtitle {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	/* Level 2: Outer accordion triggers — heavy weight, medium tracking */
	.structure :global([data-accordion-trigger]) {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		letter-spacing: 0.12em;
		font-weight: 600;
	}

	/* Level 3: Inner accordion triggers — lighter weight, tighter tracking, receded */
	.structure :global(.structure-inner [data-accordion-trigger]) {
		font-weight: 400;
		letter-spacing: 0.08em;
		color: color-mix(in srgb, var(--color-fg) 72%, transparent);
	}

	/* Fix width jump: override Accordion.svelte's global border/margin on open content,
	   and restrict transition to height-only (transition-all animates margin/padding shifts) */
	.structure :global([data-accordion-content]) {
		transition: height var(--duration-normal) var(--ease-out) !important;
	}

	.structure :global([data-accordion-content][data-state='open']) {
		border-left: none !important;
		margin-left: 0 !important;
	}

	/* Content styling */
	.structure-content {
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.structure-content p {
		margin: 0 0 var(--spacing-3);
	}

	.structure-content ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.structure-content li {
		color: var(--color-muted);
	}

	.structure-content code {
		color: var(--color-primary);
		font-size: inherit;
	}

	.structure-note {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}
</style>
