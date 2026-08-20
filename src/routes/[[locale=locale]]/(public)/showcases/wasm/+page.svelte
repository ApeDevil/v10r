<script lang="ts">
import { Card, NavSection, PageHeader, ShowcaseDocs } from '$lib/components/composites';
import CodeBlock from '$lib/components/composites/info-dialog/CodeBlock.svelte';
import { PageContainer, Stack } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
import BoundaryDemo from './_components/BoundaryDemo.svelte';
import FilterLab from './_components/FilterLab.svelte';

let { data } = $props();

const sections = $derived([
	{ id: 'wasm-pattern', label: m.showcase_wasm_section_pattern() },
	{ id: 'wasm-lab', label: m.showcase_wasm_section_lab() },
	{ id: 'wasm-boundary', label: m.showcase_wasm_section_boundary() },
	{ id: 'wasm-honesty', label: m.showcase_wasm_section_honesty() },
	{ id: 'wasm-when', label: m.showcase_wasm_section_when() },
]);
</script>

<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_wasm_title()}
		description={m.showcase_wasm_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_wasm_title() }
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavSection {sections} />

	<Stack gap="6">
		<Card id="wasm-pattern">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_wasm_section_pattern()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_wasm_pattern_intro()}</p>
			</div>

			<div class="snippet">
				<h3 class="snippet-heading">{m.showcase_wasm_pattern_kernel_heading()}</h3>
				<p class="snippet-body">{m.showcase_wasm_pattern_kernel_body()}</p>
				<CodeBlock highlightedHtml={data.snippets.kernel} language="rust" filename="crates/kernel/src/lib.rs" />
			</div>

			<div class="snippet">
				<h3 class="snippet-heading">{m.showcase_wasm_pattern_build_heading()}</h3>
				<p class="snippet-body">{m.showcase_wasm_pattern_build_body()}</p>
				<CodeBlock highlightedHtml={data.snippets.build} language="bash" filename="scripts/wasm/build.sh" />
			</div>

			<div class="snippet">
				<h3 class="snippet-heading">{m.showcase_wasm_pattern_loader_heading()}</h3>
				<p class="snippet-body">{m.showcase_wasm_pattern_loader_body()}</p>
				<CodeBlock highlightedHtml={data.snippets.loader} language="typescript" filename="src/lib/wasm/index.ts" />
			</div>
		</Card>

		<Card id="wasm-lab">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_wasm_section_lab()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_wasm_lab_intro()}</p>
			</div>

			<FilterLab />
		</Card>

		<Card id="wasm-boundary">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_wasm_section_boundary()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_wasm_boundary_intro()}</p>
			</div>

			<BoundaryDemo />
		</Card>

		<Card id="wasm-honesty">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_wasm_section_honesty()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_wasm_honesty_intro()}</p>
				<ul>
					<li>{m.showcase_wasm_honesty_warmup()}</li>
					<li>{m.showcase_wasm_honesty_interleave()}</li>
					<li>{m.showcase_wasm_honesty_median()}</li>
					<li>{m.showcase_wasm_honesty_first_run()}</li>
					<li>{m.showcase_wasm_honesty_breakdown()}</li>
				</ul>
				<p>{m.showcase_wasm_honesty_engine_note()}</p>
			</div>
		</Card>

		<Card id="wasm-when">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_wasm_section_when()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_wasm_when_intro()}</p>
			</div>

			<div class="when-grid">
				<div class="when-col">
					<h3 class="when-heading is-wins">{m.showcase_wasm_when_wins_heading()}</h3>
					<ul class="when-list">
						<li>{m.showcase_wasm_when_wins_1()}</li>
						<li>{m.showcase_wasm_when_wins_2()}</li>
						<li>{m.showcase_wasm_when_wins_3()}</li>
					</ul>
				</div>
				<div class="when-col">
					<h3 class="when-heading">{m.showcase_wasm_when_loses_heading()}</h3>
					<ul class="when-list">
						<li>{m.showcase_wasm_when_loses_1()}</li>
						<li>{m.showcase_wasm_when_loses_2()}</li>
						<li>{m.showcase_wasm_when_loses_3()}</li>
					</ul>
				</div>
			</div>

			<p class="closing-note">{m.showcase_wasm_when_note()}</p>
		</Card>
	</Stack>
</PageContainer>

<style>
	.prose-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-4);
	}

	.prose-block p,
	.prose-block li {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.7;
		color: var(--color-muted);
	}

	.prose-block ul {
		margin: 0;
		padding-left: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.snippet {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-5);
	}

	.snippet:last-child {
		margin-bottom: 0;
	}

	.snippet-heading {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.snippet-body {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.7;
		color: var(--color-muted);
	}

	.when-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--spacing-4);
	}

	.when-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.when-heading {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.when-heading.is-wins {
		color: var(--color-primary);
	}

	.when-list {
		margin: 0;
		padding-left: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.when-list li {
		font-size: var(--text-fluid-sm);
		line-height: 1.7;
		color: var(--color-muted);
	}

	.closing-note {
		margin: var(--spacing-4) 0 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.7;
		color: var(--color-muted);
	}
</style>
