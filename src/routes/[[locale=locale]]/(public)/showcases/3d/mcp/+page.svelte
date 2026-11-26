<script lang="ts">
/**
 * MCP 3D showcase — the pattern end to end, on the same modeling core every surface runs: the
 * example models are exactly what an agent sends `generate_model`, the viewer evaluates them with
 * the server's engine (in a Web Worker), a patch is applied by the same `applyModelPatch`, and the
 * share link is the same `m1.` fragment the MCP answer carries. Nothing here bypasses the domain.
 */
import { applyModelPatch, tryEncodeModelLink } from '#lib/asset-production/modeling/index.ts';
import { ModelViewer } from '#lib/components/3d/index.ts';
import { Alert, BackLink, Card, PageHeader, ShowcaseDocs } from '#lib/components/composites/index.ts';
import { Button, ToggleGroup } from '#lib/components/primitives/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { ModelPatch, ParametricModel } from '#lib/schemas/parametric-model.ts';
import { EXAMPLE_MODELS, type ExampleModelId, exampleModel } from '#lib/showcases/3d/mcp/example-models.ts';

const CATEGORIES: { id: string; example: ExampleModelId; title: () => string; body: () => string }[] = [
	{ id: 'A', example: 'primitives', title: m.showcase_3d_mcp_cat_a_title, body: m.showcase_3d_mcp_cat_a_body },
	{ id: 'B', example: 'bracket', title: m.showcase_3d_mcp_cat_b_title, body: m.showcase_3d_mcp_cat_b_body },
	{ id: 'C', example: 'organic', title: m.showcase_3d_mcp_cat_c_title, body: m.showcase_3d_mcp_cat_c_body },
	{ id: 'D', example: 'enclosure', title: m.showcase_3d_mcp_cat_d_title, body: m.showcase_3d_mcp_cat_d_body },
	{ id: 'R', example: 'perforated', title: m.showcase_3d_mcp_cat_r_title, body: m.showcase_3d_mcp_cat_r_body },
	{ id: 'X', example: 'lamp', title: m.showcase_3d_mcp_cat_x_title, body: m.showcase_3d_mcp_cat_x_body },
];

/** Category E: the patch an agent sends `modify_model`, applied by the same function the server uses. */
const PATCH: ModelPatch = { parameters: { height: 60, wall: 2 }, operations: { holes: { count: 6 } } };

let selected = $state<ExampleModelId>('enclosure');
let model = $state.raw<ParametricModel>(exampleModel('enclosure').model);
let patched = $state(false);

const category = $derived(CATEGORIES.find((c) => c.example === selected) ?? CATEGORIES[3]);
const definition = $derived(JSON.stringify(model));
const payload = $derived(tryEncodeModelLink(model));
const viewerHref = $derived(payload ? `${localizeHref('/3d/view')}#${payload}` : null);
const endpoint = $derived(typeof location === 'undefined' ? '/api/mcp/3d' : `${location.origin}/api/mcp/3d`);

function pick(id: string) {
	if (!EXAMPLE_MODELS.some((example) => example.id === id)) return;
	selected = id as ExampleModelId;
	model = exampleModel(selected).model;
	patched = false;
}

function applyPatch() {
	const next = applyModelPatch(exampleModel('enclosure').model, PATCH);
	if (!next.ok) return;
	selected = 'enclosure';
	model = next.value as ParametricModel;
	patched = true;
}
</script>

<div class="page">
	<PageHeader
		title={m.showcase_3d_mcp_title()}
		description={m.showcase_3d_mcp_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_3d_breadcrumb(), href: '/showcases/3d' },
			{ label: m.showcase_3d_mcp_breadcrumb() },
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<Alert variant="info" title={m.showcase_3d_mcp_scope_title()} description={m.showcase_3d_mcp_scope_body()} />

	<section class="pick" aria-labelledby="mcp3d-categories">
		<h2 id="mcp3d-categories" class="heading">{m.showcase_3d_mcp_categories_heading()}</h2>
		<ToggleGroup
			bind:value={() => selected, pick}
			size="sm"
			items={CATEGORIES.map((c) => ({ value: c.example, label: `${c.id} · ${c.title()}` }))}
		/>
		<p class="lead">{patched ? m.showcase_3d_mcp_cat_e_body() : category.body()}</p>
	</section>

	<ModelViewer {model} link={viewerHref ? `${typeof location === 'undefined' ? '' : location.origin}${viewerHref}` : null} onchange={(next) => (model = next)} />

	<div class="panels">
		<Card>
			{#snippet header()}
				<h2 class="heading">E · {m.showcase_3d_mcp_cat_e_title()}</h2>
			{/snippet}
			<p>{m.showcase_3d_mcp_cat_e_intro()}</p>
			<pre class="code"><code>{JSON.stringify({ tool: 'modify_model', arguments: { model: '…the enclosure…', patch: PATCH } }, null, 2)}</code></pre>
			<div class="actions">
				<Button variant="primary" size="sm" onclick={applyPatch}>{m.showcase_3d_mcp_cat_e_apply()}</Button>
				{#if patched}
					<Button variant="outline" size="sm" onclick={() => pick('enclosure')}>{m.showcase_3d_mcp_cat_e_reset()}</Button>
				{/if}
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">F · {m.showcase_3d_mcp_cat_f_title()}</h2>
			{/snippet}
			<p>{m.showcase_3d_mcp_cat_f_body()}</p>
			<p class="muted">
				{m.showcase_3d_mcp_cat_f_sizes({ definition: definition.length, link: payload?.length ?? 0 })}
			</p>
			{#if viewerHref}
				<div class="actions">
					<Button variant="outline" size="sm" href={viewerHref} target="_blank" rel="noopener">{m.showcase_3d_mcp_cat_f_open()}</Button>
				</div>
			{/if}
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">G · {m.showcase_3d_mcp_cat_g_title()}</h2>
			{/snippet}
			<p>{m.showcase_3d_mcp_cat_g_body()}</p>
			<pre class="code"><code>{`claude mcp add --transport http v10r-3d ${endpoint}`}</code></pre>
			<p class="muted">{m.showcase_3d_mcp_cat_g_tools()}</p>
			<p class="muted">{m.showcase_3d_mcp_cat_g_hosts()}</p>
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">H · {m.showcase_3d_mcp_cat_h_title()}</h2>
			{/snippet}
			<p>{m.showcase_3d_mcp_cat_h_body()}</p>
		</Card>
	</div>

	<section class="connect" aria-labelledby="mcp3d-connect">
		<h2 id="mcp3d-connect" class="heading">{m.showcase_3d_mcp_connect_heading()}</h2>
		<p>{m.showcase_3d_mcp_connect_intro()}</p>
		<pre class="code"><code>{endpoint}</code></pre>
		<div class="panels">
			<Card>
				{#snippet header()}
					<h3 class="heading">ChatGPT</h3>
				{/snippet}
				<ol class="steps">
					<li>{m.showcase_3d_mcp_connect_chatgpt_step1()}</li>
					<li>{m.showcase_3d_mcp_connect_chatgpt_step2()}</li>
					<li>{m.showcase_3d_mcp_connect_chatgpt_step3()}</li>
					<li>{m.showcase_3d_mcp_connect_chatgpt_step4()}</li>
				</ol>
				<p class="muted">{m.showcase_3d_mcp_connect_chatgpt_status()}</p>
			</Card>
			<Card>
				{#snippet header()}
					<h3 class="heading">Claude</h3>
				{/snippet}
				<ol class="steps">
					<li>{m.showcase_3d_mcp_connect_claude_step1()}</li>
					<li>{m.showcase_3d_mcp_connect_claude_step2()}</li>
				</ol>
				<p class="muted">{m.showcase_3d_mcp_connect_claude_status()}</p>
			</Card>
			<Card>
				{#snippet header()}
					<h3 class="heading">Claude Code</h3>
				{/snippet}
				<pre class="code"><code>{`claude mcp add --transport http v10r-3d ${endpoint}`}</code></pre>
				<p>{m.showcase_3d_mcp_connect_code_step()}</p>
				<p class="muted">{m.showcase_3d_mcp_connect_claude_status()}</p>
			</Card>
		</div>
		<p><a class="link" href={localizeHref('/account/connections')}>{m.showcase_3d_mcp_connect_revoke()} →</a></p>
	</section>

	<details class="definition">
		<summary>{m.showcase_3d_mcp_definition_heading({ bytes: definition.length })}</summary>
		<pre class="code"><code>{JSON.stringify(model, null, 2)}</code></pre>
	</details>

	<BackLink href="/showcases/3d" label={m.showcase_3d_breadcrumb()} />
</div>

<style>
	.page {
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.pick {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.heading {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.lead {
		color: var(--color-muted);
		margin: 0;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--spacing-4);
	}

	.muted {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-block-start: var(--spacing-2);
	}

	.code {
		font-family: var(--font-mono);
		font-size: var(--text-fluid-xs, 0.8rem);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-2) var(--spacing-3);
		overflow-x: auto;
		white-space: pre;
		margin: var(--spacing-2) 0 0;
	}

	.connect {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.connect p {
		margin: 0;
	}

	.steps {
		margin: 0;
		padding-inline-start: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.link {
		color: var(--color-primary);
	}

	.definition summary {
		cursor: pointer;
		font-weight: 600;
	}
</style>
