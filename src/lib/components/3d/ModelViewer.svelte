<script lang="ts">
/**
 * The native parametric model viewer: evaluates a model in a Web Worker (the same engine the MCP
 * 3D server runs, so the GLB is byte-identical), draws the GLB, and offers parameter edits,
 * wireframe, grid, copy, export and import. It holds no model of its own beyond `model`: the
 * page decides where a model comes from (a link fragment, an example, an imported file) and is
 * told about every change through `onchange`.
 */
import { onMount } from 'svelte';
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetDiagnostic } from '#lib/asset-production/diagnostics.ts';
import { Alert, Card, DiagGrid, DiagRow } from '#lib/components/composites/index.ts';
import { Badge, Button, Input, Spinner } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { ParametricModel } from '#lib/schemas/parametric-model.ts';
import type { ModelEvaluation } from '#lib/workers/model-evaluation.ts';
import { createModelEvaluator, EvaluationCancelled, type ModelEvaluator } from '#lib/workers/model-evaluator.ts';
import AssetCanvas from './AssetCanvas.svelte';

interface Props {
	model: ParametricModel | null;
	/** Called with every model the viewer produced (parameter edit, import). */
	onchange?: (model: ParametricModel) => void;
	/** The shareable link for the current model, if the page has one. */
	link?: string | null;
}

let { model, onchange, link = null }: Props = $props();

type Phase = 'idle' | 'running' | 'done' | 'error';
let phase = $state<Phase>('idle');
let evaluation = $state.raw<ModelEvaluation>();
let asset = $state.raw<Group>();
let problem = $state('');
let status = $state('');
let wireframe = $state(false);
let grid = $state(true);
let frameKey = $state(0);
let draft = $state<Record<string, string>>({});
let evaluator: ModelEvaluator | undefined;
let fileInput = $state<HTMLInputElement>();
let urls: { glb?: string; stl?: string; json?: string } = $state({});
let lastMs = $state<number>();
let kernelMs = $state<number>();

const summary = $derived(evaluation?.summary);
const parameterNames = $derived(Object.keys(model?.parameters ?? {}));
const dirty = $derived(parameterNames.some((name) => Number(draft[name]) !== model?.parameters?.[name]));

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2).replace(/\.?0+$/, ''));
const dims = (size: readonly number[], units: string) => `${size.map(fmt).join(' × ')} ${units}`;
const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const severityVariant = (d: AssetDiagnostic) => (d.severity === 'error' ? 'error' : 'warning');

function fileBase(): string {
	const name = (model?.name ?? 'model').toLowerCase();
	return name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

function replaceUrls(next: ModelEvaluation, source: ParametricModel) {
	for (const url of Object.values(urls)) if (url) URL.revokeObjectURL(url);
	urls = {
		glb: next.glb ? URL.createObjectURL(new Blob([next.glb as BlobPart], { type: 'model/gltf-binary' })) : undefined,
		stl: next.stl ? URL.createObjectURL(new Blob([next.stl as BlobPart], { type: 'model/stl' })) : undefined,
		json: URL.createObjectURL(new Blob([JSON.stringify(source, null, 2)], { type: 'application/json' })),
	};
}

async function run(source: ParametricModel) {
	evaluator ??= await createModelEvaluator();
	phase = 'running';
	problem = '';
	status = m.showcase_3d_viewer_status_building();
	const started = performance.now();
	try {
		const next = await evaluator.evaluate(source);
		lastMs = performance.now() - started;
		if (next.kernelLoadMs !== undefined && kernelMs === undefined) kernelMs = next.kernelLoadMs;
		evaluation = next;
		if (next.outcome !== 'succeeded' || !next.glb) {
			phase = 'error';
			problem =
				next.outcome === 'refused'
					? m.showcase_3d_viewer_error_refused()
					: next.outcome === 'cancelled'
						? m.showcase_3d_viewer_error_timeout()
						: m.showcase_3d_viewer_error_failed();
			status = problem;
			return;
		}
		const gltf = await new GLTFLoader().parseAsync(next.glb.slice().buffer as ArrayBuffer, '');
		asset = gltf.scene;
		replaceUrls(next, source);
		phase = 'done';
		status = m.showcase_3d_viewer_status_built({ ms: Math.round(lastMs) });
	} catch (error) {
		if (error instanceof EvaluationCancelled) {
			phase = asset ? 'done' : 'idle';
			status = m.showcase_3d_viewer_status_cancelled();
			return;
		}
		phase = 'error';
		problem = error instanceof Error ? error.message : String(error);
		status = problem;
	}
}

// A new model from outside (link, example, import) resets the drafts and builds it.
$effect(() => {
	const current = model;
	if (!current) return;
	draft = Object.fromEntries(Object.entries(current.parameters ?? {}).map(([name, value]) => [name, String(value)]));
	void run(current);
});

function applyParameters() {
	if (!model) return;
	const parameters: Record<string, number> = { ...(model.parameters ?? {}) };
	for (const name of parameterNames) {
		const value = Number(draft[name]);
		if (Number.isFinite(value)) parameters[name] = value;
	}
	onchange?.({ ...model, parameters });
}

async function copy(text: string, done: string) {
	try {
		await navigator.clipboard.writeText(text);
		status = done;
	} catch {
		status = m.showcase_3d_viewer_copy_failed();
	}
}

async function importFile(event: Event) {
	const file = (event.currentTarget as HTMLInputElement).files?.[0];
	if (!file) return;
	if (file.size > 64 * 1024) {
		phase = 'error';
		problem = m.showcase_3d_viewer_import_too_large();
		return;
	}
	try {
		const parsed = JSON.parse(await file.text()) as ParametricModel;
		onchange?.(parsed);
	} catch {
		phase = 'error';
		problem = m.showcase_3d_viewer_import_invalid();
	} finally {
		if (fileInput) fileInput.value = '';
	}
}

onMount(() => () => {
	evaluator?.dispose();
	for (const url of Object.values(urls)) if (url) URL.revokeObjectURL(url);
});
</script>

<div class="viewer">
	<section class="stage" aria-busy={phase === 'running'}>
		<AssetCanvas
			{asset}
			{wireframe}
			{grid}
			{frameKey}
			label={m.showcase_3d_viewer_canvas_label()}
			unavailableTitle={m.showcase_3d_produce_canvas_unavailable_title()}
			unavailableDescription={m.showcase_3d_produce_canvas_unavailable_body()}
		/>
		{#if phase === 'running'}
			<div class="overlay"><Spinner label={m.showcase_3d_viewer_status_building()} /></div>
		{:else if !asset}
			<p class="overlay empty">{m.showcase_3d_viewer_canvas_empty()}</p>
		{/if}
		<div class="tools">
			<Button size="sm" variant={wireframe ? 'primary' : 'outline'} aria-pressed={wireframe} onclick={() => (wireframe = !wireframe)}>
				{m.showcase_3d_viewer_wireframe()}
			</Button>
			<Button size="sm" variant={grid ? 'primary' : 'outline'} aria-pressed={grid} onclick={() => (grid = !grid)}>
				{m.showcase_3d_viewer_grid()}
			</Button>
			<Button size="sm" variant="outline" onclick={() => frameKey++}>{m.showcase_3d_viewer_reset_view()}</Button>
		</div>
	</section>

	<section class="controls" aria-labelledby="viewer-parameters-heading">
		<h2 id="viewer-parameters-heading" class="heading">{model?.name ?? m.showcase_3d_viewer_untitled()}</h2>

		{#if parameterNames.length > 0}
			<form
				class="parameters"
				onsubmit={(event) => {
					event.preventDefault();
					applyParameters();
				}}
			>
				{#each parameterNames as name (name)}
					<label class="field">
						<span class="field-label">{name}</span>
						<Input
							type="number"
							step="any"
							value={draft[name] ?? ''}
							oninput={(event) => (draft[name] = (event.currentTarget as HTMLInputElement).value)}
							aria-label={name}
						/>
					</label>
				{/each}
				<div class="actions">
					<Button type="submit" variant="primary" size="sm" disabled={!dirty || phase === 'running'}>
						{m.showcase_3d_viewer_apply()}
					</Button>
					{#if phase === 'running'}
						<Button variant="outline" size="sm" onclick={() => evaluator?.cancel()}>{m.showcase_3d_viewer_cancel()}</Button>
					{/if}
				</div>
			</form>
		{:else if model}
			<p class="muted">{m.showcase_3d_viewer_no_parameters()}</p>
		{/if}

		<div class="actions">
			{#if link}
				<Button variant="outline" size="sm" onclick={() => copy(link, m.showcase_3d_viewer_copied_link())}>{m.showcase_3d_viewer_copy_link()}</Button>
			{/if}
			{#if model}
				<Button variant="outline" size="sm" onclick={() => copy(JSON.stringify(model, null, 2), m.showcase_3d_viewer_copied_definition())}>
					{m.showcase_3d_viewer_copy_definition()}
				</Button>
			{/if}
			<Button variant="outline" size="sm" onclick={() => fileInput?.click()}>{m.showcase_3d_viewer_import()}</Button>
			<!-- type=file has no project component; the native input is hidden behind the button above. -->
			<input bind:this={fileInput} type="file" accept="application/json,.json" class="file-control" onchange={importFile} />
		</div>
		{#if urls.glb && summary}
			<div class="actions">
				<Button variant="outline" size="sm" href={urls.glb} download={`${fileBase()}.glb`}>GLB</Button>
				<Button variant="outline" size="sm" href={urls.stl} download={`${fileBase()}.stl`}>STL</Button>
				<Button variant="outline" size="sm" href={urls.json} download={`${fileBase()}.json`}>JSON</Button>
			</div>
		{/if}
		<p class="status" role="status" aria-live="polite">{status}</p>
	</section>
</div>

{#if phase === 'error'}
	<Alert variant="error" title={m.showcase_3d_viewer_error_title()} description={problem} />
{/if}
{#if evaluation && evaluation.diagnostics.length > 0}
	<Card>
		{#snippet header()}
			<h2 class="heading">{m.showcase_3d_viewer_findings_heading()}</h2>
		{/snippet}
		<ul class="findings">
			{#each evaluation.diagnostics as finding (finding.code + finding.subject + finding.message)}
				<li>
					<Badge variant={severityVariant(finding)}>{finding.severity}</Badge>
					<code>{finding.code}</code>
					<span class="muted">({finding.subject})</span>
					<span>{finding.message}</span>
				</li>
			{/each}
		</ul>
	</Card>
{/if}

{#if summary}
	<div class="panels">
		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_viewer_facts_heading()}</h2>
			{/snippet}
			<DiagGrid>
				<DiagRow label={m.showcase_3d_viewer_facts_size()}>{dims(summary.size, summary.units)}</DiagRow>
				<DiagRow label={m.showcase_3d_viewer_facts_triangles()}>{summary.triangles.toLocaleString()}</DiagRow>
				<DiagRow label={m.showcase_3d_viewer_facts_closed()}>
					<Badge variant={summary.closedManifold ? 'success' : 'warning'}>
						{summary.closedManifold ? m.showcase_3d_viewer_facts_closed_yes() : m.showcase_3d_viewer_facts_closed_no()}
					</Badge>
				</DiagRow>
				<DiagRow label={m.showcase_3d_viewer_facts_glb()}>{kib(summary.glbBytes)}</DiagRow>
				<DiagRow label={m.showcase_3d_viewer_facts_sha()}><code>{summary.glbSha256.slice(0, 16)}…</code></DiagRow>
			</DiagGrid>
			<ul class="components">
				{#each summary.components as component (component.name)}
					<li>
						<code>{component.name}</code>
						<span class="muted">{component.material}</span>
						{dims(component.size, summary.units)} · {fmt(component.volume)} {summary.units}³
						{#if component.genus > 0}· {m.showcase_3d_viewer_facts_holes({ count: component.genus })}{/if}
					</li>
				{/each}
			</ul>
		</Card>
		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_viewer_engine_heading()}</h2>
			{/snippet}
			<DiagGrid>
				<DiagRow label={m.showcase_3d_viewer_engine_kernel()}>{summary.engine.kernel}</DiagRow>
				<DiagRow label={m.showcase_3d_viewer_engine_pipeline()}><code>{summary.engine.pipeline} / {summary.engine.generator}</code></DiagRow>
				<DiagRow label={m.showcase_3d_viewer_engine_where()}>{m.showcase_3d_viewer_engine_where_value()}</DiagRow>
				{#if kernelMs !== undefined}
					<DiagRow label={m.showcase_3d_viewer_engine_kernel_load()}>{kernelMs.toFixed(0)} ms</DiagRow>
				{/if}
				<DiagRow label={m.showcase_3d_viewer_engine_evaluate()}>{summary.timing.totalMs.toFixed(0)} ms</DiagRow>
				{#if lastMs !== undefined}
					<DiagRow label={m.showcase_3d_viewer_engine_round_trip()}>{lastMs.toFixed(0)} ms</DiagRow>
				{/if}
				<DiagRow label={m.showcase_3d_viewer_engine_model_bytes()}>{summary.modelBytes.toLocaleString()} B</DiagRow>
			</DiagGrid>
		</Card>
	</div>
{/if}

<style>
	.viewer {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-4);
	}

	@media (min-width: 64rem) {
		.viewer {
			grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
		}
	}

	.stage {
		position: relative;
		min-height: 28rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--color-subtle);
	}

	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.empty {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.tools {
		position: absolute;
		inset-inline-start: var(--spacing-2);
		inset-block-start: var(--spacing-2);
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.heading {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.parameters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--spacing-2);
	}

	.parameters .actions {
		grid-column: 1 / -1;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.field-label,
	.muted,
	.status {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.file-control {
		display: none;
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--spacing-4);
	}

	.findings,
	.components {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.components {
		margin-block-start: var(--spacing-3);
	}
</style>
