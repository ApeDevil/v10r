<script lang="ts">
import { Accordion } from '$lib/components';
import { localizeHref } from '$lib/i18n';
import { fadeIn } from './fadeIn';
import { type StructureItem, sections } from './structure-map';

const [intelligence, structural] = sections;

function group(sectionIdx: number, groupValue: string) {
	const found = sections[sectionIdx].groups.find((g) => g.value === groupValue);
	if (!found) throw new Error(`Group "${groupValue}" not found in section ${sectionIdx}`);
	return found;
}

function getItemHref(item: StructureItem): string | null {
	for (const seg of item.segments) {
		if (seg.href) return seg.href;
	}
	return null;
}
</script>

{#snippet renderItems(items: StructureItem[])}
	<ul>
		{#each items as item}
			{@const href = getItemHref(item)}
			<li>
				{#if href}
					<a class="item-link" href={localizeHref(href)}>
						<span class="item-codes">
							{#each item.segments as seg, i}
								{#if i > 0}{' '}{/if}<code>{seg.label}</code>
							{/each}
						</span>
						<span class="item-desc">{item.description}</span>
					</a>
				{:else}
					<span class="item-plain">
						<span class="item-codes">
							{#each item.segments as seg, i}
								{#if i > 0}{' '}{/if}<code>{seg.label}</code>
							{/each}
						</span>
						<span class="item-desc">{item.description}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet renderGroup(sectionIdx: number, groupValue: string)}
	{@const g = group(sectionIdx, groupValue)}
	<div class="structure-content">
		{#if g.intro}
			<p>{g.intro}</p>
		{/if}
		{@render renderItems(g.items)}
	</div>
{/snippet}

<!-- Intelligence Layer groups -->
{#snippet agentsSnippet()}
	{@render renderGroup(0, 'agents')}
{/snippet}

{#snippet skillsSnippet()}
	{@render renderGroup(0, 'skills')}
{/snippet}

{#snippet docsHubsSnippet()}
	{@render renderGroup(0, 'docs-hubs')}
{/snippet}

<!-- Structural Map groups -->
{#snippet routesSnippet()}
	{@render renderGroup(1, 'routes')}
{/snippet}

{#snippet serverSnippet()}
	{@render renderGroup(1, 'server')}
{/snippet}

{#snippet componentsSnippet()}
	{@render renderGroup(1, 'components')}
{/snippet}

{#snippet claudeSnippet()}
	{@render renderGroup(1, 'claude')}
{/snippet}

{#snippet documentationSnippet()}
	{@render renderGroup(1, 'documentation')}
{/snippet}

<!-- Outer snippets -->
{#snippet intelligenceContent()}
	<div class="structure-content">
		<p>Specialized Claude Code agents with custom prompts, skills, and persistent memory.</p>
		<Accordion
			items={[
				{ value: 'agents', title: 'Agents', content: agentsSnippet },
				{ value: 'skills', title: 'Skills', content: skillsSnippet },
				{ value: 'docs-hubs', title: 'Documentation Hubs', content: docsHubsSnippet },
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

{#snippet nragContent()}
	<div class="structure-content">
		<p class="nrag-lede">Retrieval-Augmented Generation where the model chooses its own depth.</p>
		<p>Two layers: a standard chunk index below, and above it an LLM-authored wiki with typed pointers into specific chunk IDs. The model reads TLDRs first and calls a drill-down tool only when it needs the raw source.</p>
		{@render renderItems([
			{
				segments: [{ label: 'raw-RAG', href: '/showcases/ai/retrieval/rag-chat' }],
				description: 'hybrid vector + BM25 retrieval over raw document chunks',
			},
			{
				segments: [{ label: 'LLM-Wiki', href: '/showcases/ai/retrieval/rag-chat?mode=llmwiki' }],
				description: 'synthesized pages with typed pointers back to chunk IDs',
			},
			{
				segments: [{ label: 'drill-down', href: null }],
				description: 'tool-call escalation when the TLDR is not enough — budget 3 per turn',
			},
			{
				segments: [{ label: 'verify', href: null }],
				description: 'post-hoc citation taxonomy — quote, paraphrase, drifted, uncited',
			},
		])}
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
			{ value: 'nrag', title: 'nRAG: raw-RAG ∘ LLM-Wiki', content: nragContent },
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

	.structure-content .nrag-lede {
		font-size: var(--text-fluid-base);
		color: var(--color-fg);
		font-weight: 500;
		margin-bottom: var(--spacing-4);
	}

	/* Linked items — whole row is click target */
	.item-link {
		display: inline-flex;
		align-items: baseline;
		gap: var(--spacing-2);
		text-decoration: none;
		color: inherit;
		padding: var(--spacing-1) var(--spacing-2);
		margin-inline: calc(-1 * var(--spacing-2));
		border-radius: 2px;
		transition: background-color 120ms ease;
	}

	.item-link:hover {
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.item-link:active {
		opacity: 0.7;
	}

	.item-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Code inside links — hover border-bottom */
	.item-link code {
		border-bottom: 1px solid transparent;
		transition: border-color 120ms ease;
	}

	.item-link:hover code {
		border-bottom-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
	}

	/* Plain (unlinked) items keep existing style */
	.item-plain {
		display: inline-flex;
		align-items: baseline;
		gap: var(--spacing-2);
		padding: var(--spacing-1) 0;
	}

	/* Description text — always passive */
	.item-desc {
		color: var(--color-muted);
		cursor: default;
	}

	@media (prefers-reduced-motion: reduce) {
		.item-link {
			transition: none;
		}

		.item-link code {
			transition: none;
		}
	}
</style>
