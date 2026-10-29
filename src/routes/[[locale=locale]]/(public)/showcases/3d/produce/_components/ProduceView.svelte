<script lang="ts">
import { onMount, tick } from 'svelte';
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { apiFetch } from '#lib/api.ts';
import {
	type AssetDiagnostic,
	type AssetReport,
	DEFAULT_ASSET_BUDGET,
	structuralRingGenerator,
} from '#lib/asset-production/index.ts';
import { Alert, Card, DiagGrid, DiagRow } from '#lib/components/composites/index.ts';
import { Badge, Button, Select, Slider, Spinner, ToggleGroup } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	ASSET_REQUEST_FORMAT,
	type BracingPattern,
	STRUCTURAL_RING_BOUNDS,
	type StructuralRingParameters,
} from '#lib/schemas/asset-production.ts';

import { PRODUCE_PRESETS, type ProducePresetId } from '#lib/showcases/3d/produce/presets.ts';
import AssetCanvas from './AssetCanvas.svelte';

/** Read in the markup too; a script-level value keeps the import a value import. */
const BOUNDS = STRUCTURAL_RING_BOUNDS;
type NumericParameter = keyof typeof BOUNDS;

const PARAMETERS: { key: NumericParameter; label: () => string; unit?: string }[] = [
	{ key: 'ringRadius', label: m.showcase_3d_produce_param_ring_radius, unit: 'm' },
	{ key: 'bays', label: m.showcase_3d_produce_param_bays },
	{ key: 'trussDepth', label: m.showcase_3d_produce_param_truss_depth, unit: 'm' },
	{ key: 'trussHeight', label: m.showcase_3d_produce_param_truss_height, unit: 'm' },
	{ key: 'strutRadius', label: m.showcase_3d_produce_param_strut_radius, unit: 'm' },
	{ key: 'spokes', label: m.showcase_3d_produce_param_spokes },
	{ key: 'hubRadius', label: m.showcase_3d_produce_param_hub_radius, unit: 'm' },
	{ key: 'modules', label: m.showcase_3d_produce_param_modules },
	{ key: 'detail', label: m.showcase_3d_produce_param_detail },
];
const BRACING: { value: BracingPattern; label: () => string }[] = [
	{ value: 'warren', label: m.showcase_3d_produce_bracing_warren },
	{ value: 'pratt', label: m.showcase_3d_produce_bracing_pratt },
	{ value: 'x-brace', label: m.showcase_3d_produce_bracing_x_brace },
];
const CHECKS = [
	m.showcase_3d_produce_check_schema,
	m.showcase_3d_produce_check_budget,
	m.showcase_3d_produce_check_shells,
	m.showcase_3d_produce_check_finite,
	m.showcase_3d_produce_check_envelope,
	m.showcase_3d_produce_check_glb,
];
const STAGES = ['check', 'generate', 'inspect', 'encode', 'verify'] as const;

let preset = $state<ProducePresetId>('default');
let parameters = $state<StructuralRingParameters>({ ...PRODUCE_PRESETS.default });

// The same core the server runs answers "is this allowed, and how big?" before anything is sent.
const preflight = $derived(structuralRingGenerator.check(parameters));
const estimate = $derived(structuralRingGenerator.estimate(parameters));
const overBudget = $derived(estimate.triangles > DEFAULT_ASSET_BUDGET.maxTriangles);

type Phase = 'idle' | 'running' | 'done' | 'error';
let phase = $state<Phase>('idle');
let problem = $state('');
let report = $state.raw<AssetReport>();
let asset = $state.raw<Group>();
let glbUrl = $state<string>();
let client = $state<{ roundTripMs: number; parseMs: number; paintMs?: number }>();
let controller: AbortController | undefined;
let paintStarted = 0;
let status = $state('');

function applyPreset(id: string) {
	if (!(id in PRODUCE_PRESETS)) return;
	preset = id as ProducePresetId;
	parameters = { ...PRODUCE_PRESETS[preset] };
}

const decodeBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function generate() {
	controller?.abort();
	controller = new AbortController();
	phase = 'running';
	problem = '';
	status = m.showcase_3d_produce_generating();
	const started = performance.now();
	try {
		const response = await apiFetch('/api/showcases/asset-production', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ format: ASSET_REQUEST_FORMAT, generator: 'structural-ring', parameters }),
			signal: controller.signal,
		});
		const body = (await response.json()) as {
			data?: { report: AssetReport; glbBase64?: string };
			error?: { message: string };
		};
		const roundTripMs = performance.now() - started;
		if (!body.data) {
			phase = 'error';
			problem =
				response.status === 429
					? m.showcase_3d_produce_error_rate_limited()
					: (body.error?.message ?? String(response.status));
			status = problem;
			return;
		}
		report = body.data.report;
		if (!body.data.glbBase64) {
			phase = 'done';
			client = undefined;
			status = m.showcase_3d_produce_status_not_produced();
			return;
		}
		const parseStarted = performance.now();
		const bytes = decodeBase64(body.data.glbBase64);
		const gltf = await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer, '');
		client = { roundTripMs, parseMs: performance.now() - parseStarted };
		if (glbUrl) URL.revokeObjectURL(glbUrl);
		glbUrl = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
		paintStarted = performance.now();
		asset = gltf.scene;
		phase = 'done';
		status = m.showcase_3d_produce_status_succeeded({ ms: Math.round(report.measurements.totalMs) });
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			phase = 'idle';
			status = m.showcase_3d_produce_status_cancelled();
			return;
		}
		phase = 'error';
		problem = m.showcase_3d_produce_error_network({ message: error instanceof Error ? error.message : String(error) });
		status = problem;
	}
}

function cancel() {
	controller?.abort();
}

async function painted() {
	if (!client || client.paintMs !== undefined) return;
	client = { ...client, paintMs: performance.now() - paintStarted };
	await tick();
}

onMount(() => {
	void generate();
	return () => {
		controller?.abort();
		if (glbUrl) URL.revokeObjectURL(glbUrl);
	};
});

const reportUrl = $derived(
	report ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, '\t'))}` : undefined,
);
const ms = (value: number | undefined) => (value === undefined ? '—' : `${value.toFixed(1)} ms`);
const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const metres = (value: number) => `${value.toFixed(2)} m`;
const extent = (r: AssetReport) => {
	const b = r.inspection?.bounds;
	return b ? b.max.map((max, axis) => metres(max - b.min[axis])).join(' × ') : '—';
};
const severityVariant = (d: AssetDiagnostic) => (d.severity === 'error' ? 'error' : 'warning');
</script>

<div class="produce">
	<section class="stage" aria-busy={phase === 'running'}>
		<AssetCanvas
			{asset}
			label={m.showcase_3d_produce_canvas_label()}
			unavailableTitle={m.showcase_3d_produce_canvas_unavailable_title()}
			unavailableDescription={m.showcase_3d_produce_canvas_unavailable_body()}
			onpainted={painted}
		/>
		{#if phase === 'running'}
			<div class="overlay"><Spinner label={m.showcase_3d_produce_generating()} /></div>
		{:else if !asset}
			<p class="overlay empty">{m.showcase_3d_produce_canvas_empty()}</p>
		{/if}
	</section>

	<section class="controls" aria-labelledby="produce-parameters-heading">
		<h2 id="produce-parameters-heading" class="heading">{m.showcase_3d_produce_parameters_heading()}</h2>

		<div class="field">
			<span class="field-label" id="produce-preset-label">{m.showcase_3d_produce_preset_label()}</span>
			<div role="group" aria-labelledby="produce-preset-label">
				<ToggleGroup
					bind:value={() => preset, applyPreset}
					size="sm"
					items={[
						{ value: 'outpost', label: m.showcase_3d_produce_preset_outpost() },
						{ value: 'default', label: m.showcase_3d_produce_preset_default() },
						{ value: 'station', label: m.showcase_3d_produce_preset_station() },
					]}
				/>
			</div>
		</div>

		{#each PARAMETERS as parameter (parameter.key)}
			{@const bound = BOUNDS[parameter.key]}
			<div class="field">
				<div class="field-row">
					<span class="field-label">{parameter.label()}</span>
					<span class="field-value">{parameters[parameter.key]}{parameter.unit ? ` ${parameter.unit}` : ''}</span>
				</div>
				<Slider
					size="sm"
					label={parameter.label()}
					min={bound.min}
					max={bound.max}
					step={bound.step}
					bind:value={() => [parameters[parameter.key]], (next) => (parameters[parameter.key] = next[0])}
				/>
			</div>
		{/each}

		<div class="field">
			<span class="field-label">{m.showcase_3d_produce_param_bracing()}</span>
			<Select
				options={BRACING.map((option) => ({ value: option.value, label: option.label() }))}
				bind:value={() => parameters.bracing, (next) => (parameters.bracing = next as BracingPattern)}
			/>
		</div>

		<p class="estimate" class:over={overBudget}>
			{m.showcase_3d_produce_estimate({ triangles: estimate.triangles.toLocaleString(), budget: DEFAULT_ASSET_BUDGET.maxTriangles.toLocaleString() })}
		</p>
		{#each preflight as finding (finding.subject + finding.message)}
			<Alert variant="warning" description={finding.message} />
		{/each}

		<div class="actions">
			<Button variant="primary" onclick={generate} disabled={phase === 'running'}>
				{report ? m.showcase_3d_produce_regenerate() : m.showcase_3d_produce_generate()}
			</Button>
			{#if phase === 'running'}
				<Button variant="outline" onclick={cancel}>{m.showcase_3d_produce_cancel()}</Button>
			{/if}
		</div>
		<p class="status" role="status" aria-live="polite">{status}</p>
	</section>
</div>

{#if phase === 'error'}
	<Alert variant="error" title={m.showcase_3d_produce_error_title()} description={problem} />
{/if}

{#if report}
	<div class="panels">
		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_produce_validation_heading()}</h2>
			{/snippet}
			<div class="panel-body">
				{#if report.diagnostics.length === 0}
					<p class="lead">{m.showcase_3d_produce_validation_clean()}</p>
					<ul class="checks">
						{#each CHECKS as check}
							<li><Badge variant="success">✓</Badge> {check()}</li>
						{/each}
					</ul>
				{:else}
					<ul class="findings">
						{#each report.diagnostics as finding (finding.code + finding.subject + finding.message)}
							<li>
								<Badge variant={severityVariant(finding)}>{finding.severity}</Badge>
								<code>{finding.code}</code>
								<span class="muted">({finding.subject})</span>
								<span>{finding.message}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_produce_output_heading()}</h2>
			{/snippet}
			<div class="panel-body">
				<DiagGrid>
					<DiagRow label={m.showcase_3d_produce_output_outcome()}><Badge variant={report.outcome === 'succeeded' ? 'success' : 'error'}>{report.outcome}</Badge></DiagRow>
					{#if report.output}
						<DiagRow label={m.showcase_3d_produce_output_format()}><code>{report.output.mediaType}</code></DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_size()}>{kib(report.output.bytes)}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_triangles()}>{report.output.triangles.toLocaleString()}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_vertices()}>{report.output.vertices.toLocaleString()}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_meshes()}>{report.output.meshes} / {report.inspection?.shells ?? '—'}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_extent()}>{extent(report)}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_output_sha()}><code>{report.output.sha256}</code></DiagRow>
					{:else if report.estimate}
						<DiagRow label={m.showcase_3d_produce_output_triangles()}>{report.estimate.triangles.toLocaleString()}</DiagRow>
					{/if}
					{#if report.derivation}
						<DiagRow label={m.showcase_3d_produce_output_derivation()}><code>{report.derivation.derivationKey}</code></DiagRow>
					{/if}
					<DiagRow label={m.showcase_3d_produce_output_stored()}>{m.showcase_3d_produce_output_not_stored()}</DiagRow>
				</DiagGrid>
				{#if glbUrl && report.output}
					<div class="actions">
						<Button variant="outline" size="sm" href={glbUrl} download="structural-ring.glb">{m.showcase_3d_produce_download_glb()}</Button>
						<Button variant="outline" size="sm" href={reportUrl} download="structural-ring.report.json">{m.showcase_3d_produce_download_report()}</Button>
					</div>
				{/if}
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_produce_engine_heading()}</h2>
			{/snippet}
			<div class="panel-body">
				<DiagGrid>
					<DiagRow label={m.showcase_3d_produce_engine_engine()}><code>{report.engine.id}@{report.engine.version}</code></DiagRow>
					<DiagRow label={m.showcase_3d_produce_engine_label()}>{report.engine.label}</DiagRow>
					{#if report.generator}
						<DiagRow label={m.showcase_3d_produce_engine_generator()}><code>{report.generator.id}@{report.generator.version}</code></DiagRow>
					{/if}
					<DiagRow label={m.showcase_3d_produce_engine_environment()}><code>{report.environment.id}</code></DiagRow>
					<DiagRow label={m.showcase_3d_produce_engine_runtime()}><code>{report.environment.runtime}</code></DiagRow>
					<DiagRow label={m.showcase_3d_produce_engine_budget()}>
						{m.showcase_3d_produce_engine_budget_value({
							triangles: report.environment.budget.maxTriangles.toLocaleString(),
							size: kib(report.environment.budget.maxGlbBytes),
						})}
					</DiagRow>
				</DiagGrid>
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<h2 class="heading">{m.showcase_3d_produce_measure_heading()}</h2>
			{/snippet}
			<div class="panel-body">
				<DiagGrid>
					<DiagRow label={m.showcase_3d_produce_measure_server_total()}>{ms(report.measurements.totalMs)}</DiagRow>
					{#each STAGES as stage}
						{#if report.measurements.stageMs[stage] !== undefined}
							<DiagRow label={`· ${stage}`}>{ms(report.measurements.stageMs[stage])}</DiagRow>
						{/if}
					{/each}
					{#if report.measurements.cpuUserMs !== undefined}
						<DiagRow label={m.showcase_3d_produce_measure_cpu()}>{ms((report.measurements.cpuUserMs ?? 0) + (report.measurements.cpuSystemMs ?? 0))}</DiagRow>
					{/if}
					{#if client}
						<DiagRow label={m.showcase_3d_produce_measure_round_trip()}>{ms(client.roundTripMs)}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_measure_parse()}>{ms(client.parseMs)}</DiagRow>
						<DiagRow label={m.showcase_3d_produce_measure_paint()}>{ms(client.paintMs)}</DiagRow>
					{/if}
				</DiagGrid>
				<p class="note">{m.showcase_3d_produce_measure_note()}</p>
			</div>
		</Card>
	</div>
{/if}

<style>
	.produce {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-4);
	}

	@media (min-width: 64rem) {
		.produce {
			grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
		}
	}

	.stage {
		position: relative;
		min-height: 26rem;
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

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.field-row {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-2);
	}

	.field-label {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.field-value {
		font-variant-numeric: tabular-nums;
		font-size: var(--text-fluid-sm);
	}

	.estimate {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	.estimate.over {
		color: var(--color-error);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-top: var(--spacing-2);
	}

	.status {
		min-height: 1.5em;
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: var(--spacing-4);
	}

	.panel-body {
		padding: var(--spacing-3) var(--spacing-4);
	}

	.lead {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.checks,
	.findings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.findings code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.muted,
	.note {
		color: var(--color-muted);
	}

	.note {
		margin: var(--spacing-3) 0 0;
		font-size: var(--text-fluid-xs);
	}
</style>
