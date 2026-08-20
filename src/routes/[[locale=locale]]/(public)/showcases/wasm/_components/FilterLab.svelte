<script lang="ts">
/**
 * The wasm-vs-JS filter lab — one algorithm, two engines, honest numbers.
 *
 * Both engines run inside the SAME worker (kernel-bench.worker.ts), so the only
 * variable is the language. The worker owns the protocol (warm-up, interleaved
 * rounds, per-stage boundary timing); this component owns rendering: source and
 * result frames, per-lane statistics, and the checksum proof that both engines
 * did identical work.
 */
import { onMount } from 'svelte';
import { Button, Slider, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { type BenchStats, formatMs, stageStats } from '$lib/wasm/bench';
import { makeTestImage } from '$lib/wasm/filters';
import type { BenchFilter, BenchRequest, BenchResponse } from '$lib/wasm/kernel-bench.worker';

const WIDTH = 384;
const HEIGHT = 384;
const WARMUP = 3;
// Even count: with the order alternating each round, both AB and BA run equally often.
const ROUNDS = 10;

interface LaneView {
	total: BenchStats;
	compute: BenchStats;
	copyIn: number;
	copyOut: number;
	checksum: string;
	pixels: ArrayBuffer;
}

let filter = $state<string>('blur');
let radius = $state<number[]>([4]);
let running = $state(false);
let progress = $state<{ done: number; total: number } | null>(null);
let error = $state<string | null>(null);
let initMs = $state<number | null>(null);
let jsLane = $state<LaneView | null>(null);
let wasmLane = $state<LaneView | null>(null);
let userAgent = $state('');

let sourceCanvas = $state<HTMLCanvasElement | null>(null);
let jsCanvas = $state<HTMLCanvasElement | null>(null);
let wasmCanvas = $state<HTMLCanvasElement | null>(null);

let worker: Worker | null = null;
let requestId = 0;

// SSR must stay neutral: the server cannot know the browser's capabilities, so
// the unsupported verdict only renders after mount, from the client's own check.
let mounted = $state(false);
onMount(() => {
	mounted = true;
});
const supported = typeof WebAssembly === 'object';
const taps = $derived((2 * radius[0] + 1) ** 2);
const checksumsMatch = $derived(jsLane !== null && wasmLane !== null && jsLane.checksum === wasmLane.checksum);
const speedupCompute = $derived(
	jsLane && wasmLane && wasmLane.compute.median > 0 ? jsLane.compute.median / wasmLane.compute.median : null,
);
const speedupTotal = $derived(
	jsLane && wasmLane && wasmLane.total.median > 0 ? jsLane.total.median / wasmLane.total.median : null,
);

$effect(() => {
	if (sourceCanvas) {
		const ctx = sourceCanvas.getContext('2d');
		ctx?.putImageData(new ImageData(makeTestImage(WIDTH, HEIGHT), WIDTH, HEIGHT), 0, 0);
	}
});

$effect(() => {
	drawResult(jsCanvas, jsLane);
});

$effect(() => {
	drawResult(wasmCanvas, wasmLane);
});

$effect(() => {
	return () => {
		worker?.terminate();
		worker = null;
	};
});

function drawResult(canvas: HTMLCanvasElement | null, lane: LaneView | null) {
	if (!canvas || !lane) return;
	const ctx = canvas.getContext('2d');
	ctx?.putImageData(new ImageData(new Uint8ClampedArray(lane.pixels), WIDTH, HEIGHT), 0, 0);
}

async function getWorker(): Promise<Worker> {
	// Lazy `?worker` import: the worker module (and through it the wasm glue) is
	// never touched during SSR. One worker for the component lifetime — spawning
	// per run would charge every run the module boot cost.
	if (!worker) {
		const { default: BenchWorker } = await import('$lib/wasm/kernel-bench.worker?worker');
		worker = new BenchWorker();
	}
	return worker;
}

function laneView(report: {
	rounds: { copyIn: number; compute: number; copyOut: number }[];
	checksum: string;
	pixels: ArrayBuffer;
}): LaneView {
	const stats = stageStats(report.rounds);
	return {
		total: stats.total,
		compute: stats.compute,
		copyIn: stats.copyIn.median,
		copyOut: stats.copyOut.median,
		checksum: report.checksum,
		pixels: report.pixels,
	};
}

async function run() {
	if (running) return;
	running = true;
	error = null;
	progress = null;
	jsLane = null;
	wasmLane = null;

	try {
		const active = await getWorker();
		const id = ++requestId;
		const pixels = makeTestImage(WIDTH, HEIGHT);

		const done = await new Promise<Extract<BenchResponse, { type: 'done' }>>((resolve, reject) => {
			const cleanup = () => {
				active.removeEventListener('message', onMessage);
				active.removeEventListener('error', onWorkerError);
				active.removeEventListener('messageerror', onWorkerError);
			};
			const onMessage = (event: MessageEvent<BenchResponse>) => {
				if (event.data.id !== id) return;
				if (event.data.type === 'progress') {
					progress = { done: event.data.done, total: event.data.total };
					return;
				}
				cleanup();
				if (event.data.type === 'done') resolve(event.data);
				else reject(new Error(event.data.error));
			};
			// A worker that fails to boot (chunk 404, CSP, wasm mis-served) surfaces
			// here, never as a protocol message — without this the button hangs
			// forever. The worker is torn down so the next run spawns a fresh one.
			const onWorkerError = (event: Event) => {
				cleanup();
				worker?.terminate();
				worker = null;
				reject(new Error(event instanceof ErrorEvent && event.message ? event.message : 'Worker failed'));
			};
			active.addEventListener('message', onMessage);
			active.addEventListener('error', onWorkerError);
			active.addEventListener('messageerror', onWorkerError);

			const request: BenchRequest = {
				id,
				filter: filter as BenchFilter,
				width: WIDTH,
				height: HEIGHT,
				radius: radius[0],
				pixels: pixels.buffer,
				warmup: WARMUP,
				rounds: ROUNDS,
			};
			active.postMessage(request, [pixels.buffer]);
		});

		jsLane = laneView(done.js);
		wasmLane = laneView(done.wasm);
		if (done.initMs > 0) initMs = done.initMs;
		userAgent = navigator.userAgent;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		running = false;
		progress = null;
	}
}
</script>

<div class="lab">
	{#if !mounted}
		<p class="note">{m.showcase_wasm_lab_loading()}</p>
	{:else if !supported}
		<p class="note">{m.showcase_wasm_lab_unsupported()}</p>
	{:else}
		<div class="controls">
			<div class="control">
				<span class="control-label">{m.showcase_wasm_lab_filter_label()}</span>
				<ToggleGroup
					bind:value={filter}
					items={[
						{ value: 'blur', label: m.showcase_wasm_lab_filter_blur() },
						{ value: 'grayscale', label: m.showcase_wasm_lab_filter_grayscale() },
					]}
					disabled={running}
				/>
			</div>

			{#if filter === 'blur'}
				<div class="control">
					<span class="control-label">
						{m.showcase_wasm_lab_radius_label()}: {radius[0]} · {m.showcase_wasm_lab_taps({ taps: String(taps) })}
					</span>
					<Slider bind:value={radius} min={1} max={8} step={1} disabled={running} class="radius-slider" />
				</div>
			{/if}

			<Button onclick={run} disabled={running}>
				{#if running && progress}
					{m.showcase_wasm_lab_running({ done: String(progress.done), total: String(progress.total) })}
				{:else if running}
					{m.showcase_wasm_lab_running({ done: '0', total: String((WARMUP + ROUNDS) * 2) })}
				{:else}
					{m.showcase_wasm_lab_run()}
				{/if}
			</Button>
		</div>

		{#if error}
			<p class="error-text">{error}</p>
		{/if}

		<div class="frames">
			<figure class="frame">
				<canvas bind:this={sourceCanvas} width={WIDTH} height={HEIGHT}></canvas>
				<figcaption>{m.showcase_wasm_lab_source()}</figcaption>
			</figure>
			{#if jsLane}
				<figure class="frame">
					<canvas bind:this={jsCanvas} width={WIDTH} height={HEIGHT}></canvas>
					<figcaption>{m.showcase_wasm_lab_lane_js()}</figcaption>
				</figure>
			{/if}
			{#if wasmLane}
				<figure class="frame">
					<canvas bind:this={wasmCanvas} width={WIDTH} height={HEIGHT}></canvas>
					<figcaption>{m.showcase_wasm_lab_lane_wasm()}</figcaption>
				</figure>
			{/if}
		</div>

		{#if jsLane && wasmLane}
			<div class="lanes">
				{#each [{ label: m.showcase_wasm_lab_lane_js(), lane: jsLane, boundary: false }, { label: m.showcase_wasm_lab_lane_wasm(), lane: wasmLane, boundary: true }] as entry (entry.label)}
					<div class="lane">
						<h3 class="lane-title">{entry.label}</h3>
						<dl class="metrics">
							<div class="metric">
								<dt>{m.showcase_wasm_lab_metric_total()}</dt>
								<dd>{formatMs(entry.lane.total.median)} ms</dd>
							</div>
							<div class="metric">
								<dt>{m.showcase_wasm_lab_metric_compute()}</dt>
								<dd>{formatMs(entry.lane.compute.median)} ms</dd>
							</div>
							<div class="metric">
								<dt>{m.showcase_wasm_lab_metric_spread()}</dt>
								<dd>{formatMs(entry.lane.total.min)}–{formatMs(entry.lane.total.max)} ms</dd>
							</div>
						</dl>
						{#if entry.boundary}
							<dl class="metrics stages">
								<div class="metric">
									<dt>{m.showcase_wasm_lab_stage_copy_in()}</dt>
									<dd>{formatMs(entry.lane.copyIn)} ms</dd>
								</div>
								<div class="metric">
									<dt>{m.showcase_wasm_lab_stage_compute()}</dt>
									<dd>{formatMs(entry.lane.compute.median)} ms</dd>
								</div>
								<div class="metric">
									<dt>{m.showcase_wasm_lab_stage_copy_out()}</dt>
									<dd>{formatMs(entry.lane.copyOut)} ms</dd>
								</div>
							</dl>
						{:else}
							<p class="no-copy">{m.showcase_wasm_lab_no_copy()}</p>
						{/if}
						<p class="checksum">{m.showcase_wasm_lab_checksum()}: <code>{entry.lane.checksum}</code></p>
					</div>
				{/each}
			</div>

			<p class="verdict" class:bad={!checksumsMatch}>
				{#if checksumsMatch}
					{m.showcase_wasm_lab_checksum_match()}
					{#if speedupCompute !== null && speedupTotal !== null}
						· {m.showcase_wasm_lab_verdict({
							compute: speedupCompute.toFixed(1),
							total: speedupTotal.toFixed(1),
						})}
					{/if}
				{:else}
					{m.showcase_wasm_lab_checksum_mismatch()}
				{/if}
			</p>

			<p class="fine-print">
				{m.showcase_wasm_lab_protocol({ warmup: String(WARMUP), rounds: String(ROUNDS) })}
				{#if initMs !== null}
					{m.showcase_wasm_lab_init({ ms: formatMs(initMs) })}
				{/if}
			</p>
			{#if userAgent}
				<p class="fine-print">{m.showcase_wasm_lab_ua({ ua: userAgent })}</p>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.lab {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--spacing-4);
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 12rem;
	}

	.control-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.control :global(.radius-slider) {
		width: 12rem;
	}

	.note,
	.error-text,
	.no-copy,
	.fine-print {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.error-text {
		color: var(--color-error);
	}

	.frames {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
	}

	.frame {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.frame canvas {
		width: min(100%, 11rem);
		height: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		image-rendering: auto;
	}

	.frame figcaption {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.lanes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--spacing-3);
	}

	.lane {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.lane-title {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.metrics {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-4);
		margin: 0;
	}

	.stages {
		padding-top: var(--spacing-2);
		border-top: 1px dashed var(--color-border);
	}

	.metric dt {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.metric dd {
		margin: 0;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.checksum {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.checksum code {
		font-family: ui-monospace, monospace;
	}

	.verdict {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.verdict.bad {
		color: var(--color-error);
	}
</style>
