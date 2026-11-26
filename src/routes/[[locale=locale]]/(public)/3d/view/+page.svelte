<script lang="ts">
/**
 * `/3d/view#m1.…` — the reproducible model link every MCP 3D answer carries. The fragment holds
 * the whole model (deflated, base64url); it is decoded here, evaluated in the visitor's browser,
 * and never sent anywhere. Editing a parameter or importing a file rewrites the fragment, so the
 * address bar is always a link to exactly what is on screen.
 */
import { onMount } from 'svelte';
import { decodeModelLink, tryEncodeModelLink } from '#lib/asset-production/modeling/model-link.ts';
import { ModelViewer } from '#lib/components/3d/index.ts';
import { Alert } from '#lib/components/composites/index.ts';
import { PageHeader } from '#lib/components/index.ts';
import { Button } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { ParametricModel } from '#lib/schemas/parametric-model.ts';
import { EXAMPLE_MODELS } from '#lib/showcases/3d/mcp/example-models.ts';
import { replaceState } from '$app/navigation';

let model = $state.raw<ParametricModel | null>(null);
let linkProblem = $state<string | null>(null);
let link = $state<string | null>(null);

const REASONS: Record<string, () => string> = {
	'not-a-model-link': m.showcase_3d_viewer_link_not_a_model,
	'unsupported-version': m.showcase_3d_viewer_link_unsupported,
	'too-long': m.showcase_3d_viewer_link_too_long,
	malformed: m.showcase_3d_viewer_link_malformed,
	'too-large': m.showcase_3d_viewer_link_too_large,
};

function readFragment() {
	const fragment = location.hash;
	if (fragment.length <= 1) {
		model = null;
		link = null;
		linkProblem = null;
		return;
	}
	const decoded = decodeModelLink(fragment);
	if (!decoded.ok) {
		linkProblem = (REASONS[decoded.reason] ?? m.showcase_3d_viewer_link_malformed)();
		model = null;
		link = null;
		return;
	}
	linkProblem = null;
	link = location.href;
	model = decoded.value as ParametricModel;
}

function show(next: ParametricModel) {
	const payload = tryEncodeModelLink(next);
	if (payload) {
		replaceState(`#${payload}`, {});
		link = `${location.origin}${location.pathname}#${payload}`;
	} else {
		link = null;
	}
	linkProblem = null;
	model = next;
}

onMount(() => {
	readFragment();
	window.addEventListener('hashchange', readFragment);
	return () => window.removeEventListener('hashchange', readFragment);
});
</script>

<div class="page">
	<PageHeader
		title={m.showcase_3d_viewer_title()}
		description={m.showcase_3d_viewer_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_3d_mcp_breadcrumb(), href: '/showcases/3d/mcp' },
			{ label: m.showcase_3d_viewer_breadcrumb() },
		]}
	/>

	<Alert variant="info" title={m.showcase_3d_viewer_privacy_title()} description={m.showcase_3d_viewer_privacy_body()} />

	{#if linkProblem}
		<Alert variant="error" title={m.showcase_3d_viewer_link_problem_title()} description={linkProblem} />
	{/if}

	<div class="examples" role="group" aria-label={m.showcase_3d_viewer_examples_label()}>
		<span class="label">{m.showcase_3d_viewer_examples_label()}</span>
		{#each EXAMPLE_MODELS as example (example.id)}
			<Button variant="outline" size="sm" onclick={() => show(example.model)}>{example.model.name}</Button>
		{/each}
	</div>

	<ModelViewer {model} {link} onchange={show} />
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

	.examples {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.label {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
</style>
