<script lang="ts">
/**
 * Worker A demo — the same image analysis run two ways.
 *
 * The point is not the palette; it is the jank meter. Both buttons call the exact
 * same analyseImage() from $lib/workers/image-analysis.ts, so the only variable is
 * WHERE it runs. On the main thread the rAF loop below stops being serviced and the
 * spinner freezes; in the worker it keeps ticking.
 */
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { type AnalysisResult, analyseImage, canAnalyseImages } from '$lib/workers/image-analysis';
import type { WorkerRequest, WorkerResponse } from '$lib/workers/image-analysis.worker';

/** Frame gaps above this are visible stutter rather than normal scheduling noise. */
const SMOOTH_FRAME_MS = 32;

let file = $state<File | null>(null);
let previewUrl = $state<string | null>(null);
let dragOver = $state(false);
let running = $state<'main' | 'worker' | null>(null);
let error = $state<string | null>(null);

let mainResult = $state<AnalysisResult | null>(null);
let workerResult = $state<AnalysisResult | null>(null);
let mainJank = $state<number | null>(null);
let workerJank = $state<number | null>(null);

/** Ticks whenever the main thread is free. Visibly stalls during a blocking run. */
let spinnerAngle = $state(0);
let peakFrameMs = $state(0);

let worker: Worker | null = null;
let requestId = 0;

const supported = typeof window !== 'undefined' && canAnalyseImages();

$effect(() => {
	// One rAF loop for the component's lifetime — the honest jank probe. It cannot
	// run while the main thread is busy, which is exactly what we are measuring.
	let frame = 0;
	let last = performance.now();

	const tick = (now: number) => {
		const delta = now - last;
		last = now;
		// Recorded unconditionally rather than gated on `running`. Both this callback
		// and nextFrame()'s resolver fire in the SAME frame, in registration order —
		// gating on `running` made the measurement depend on which ran first, and when
		// the resolver won, the run cleared `running` before this line ever saw the
		// stalled frame. peakFrameMs is reset at the start of every run instead.
		peakFrameMs = Math.max(peakFrameMs, delta);
		spinnerAngle = (spinnerAngle + Math.min(delta, 100) * 0.25) % 360;
		frame = requestAnimationFrame(tick);
	};

	frame = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(frame);
});

$effect(() => {
	return () => {
		worker?.terminate();
		worker = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	};
});

/** Give up waiting for a frame that a background tab will never deliver. */
const FRAME_WAIT_TIMEOUT_MS = 250;

/**
 * Resolve after the next delivered animation frame, or after a short timeout.
 *
 * Load-bearing for the measurement: rAF cannot fire while the main thread is
 * blocked, so at the moment the blocking work finishes the stalled frame has NOT
 * been delivered yet. Reading peakFrameMs immediately would always report 0 —
 * the gap lands one tick later, after `running` has already been cleared.
 *
 * The timeout is equally load-bearing: rAF does not fire AT ALL in a hidden tab,
 * so waiting on it alone would hang the run forever the moment someone starts an
 * analysis and switches tabs. A hidden tab then reports no jank, which is correct —
 * there were no frames to miss.
 */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		requestAnimationFrame(finish);
		setTimeout(finish, FRAME_WAIT_TIMEOUT_MS);
	});
}

async function getWorker(): Promise<Worker> {
	// Imported lazily so the `?worker` module is never touched during SSR, and kept
	// alive once spawned: a worker per run would charge every run the module boot
	// cost and make the comparison dishonest.
	if (!worker) {
		const { default: ImageAnalysisWorker } = await import('$lib/workers/image-analysis.worker?worker');
		worker = new ImageAnalysisWorker();
	}
	return worker;
}

function acceptFile(next: File | null) {
	if (!next || !next.type.startsWith('image/')) {
		error = m.showcase_workers_thread_error_type();
		return;
	}
	if (previewUrl) URL.revokeObjectURL(previewUrl);
	file = next;
	previewUrl = URL.createObjectURL(next);
	error = null;
	mainResult = null;
	workerResult = null;
	mainJank = null;
	workerJank = null;
}

function handleDrop(event: DragEvent) {
	event.preventDefault();
	dragOver = false;
	acceptFile(event.dataTransfer?.files?.[0] ?? null);
}

function handleDragOver(event: DragEvent) {
	event.preventDefault();
	dragOver = true;
}

function handleDragLeave() {
	dragOver = false;
}

function handleSelect(event: Event) {
	acceptFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null);
}

async function runOnMainThread() {
	if (!file || running) return;
	running = 'main';
	peakFrameMs = 0;
	error = null;

	try {
		// Re-read the bytes each run: the worker path transfers (neuters) its buffer.
		const bytes = await file.arrayBuffer();
		mainResult = await analyseImage({ bytes });
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		// Two frames, not one: the first delivers the stalled frame, the second
		// guarantees the probe's tick has processed it regardless of callback order.
		await nextFrame();
		await nextFrame();
		mainJank = Math.round(peakFrameMs);
		running = null;
	}
}

async function runInWorker() {
	if (!file || running) return;
	running = 'worker';
	peakFrameMs = 0;
	error = null;

	try {
		const bytes = await file.arrayBuffer();
		const id = ++requestId;
		const active = await getWorker();

		const result = await new Promise<AnalysisResult>((resolve, reject) => {
			const onMessage = (event: MessageEvent<WorkerResponse>) => {
				if (event.data.id !== id) return;
				active.removeEventListener('message', onMessage);
				if (event.data.ok) resolve(event.data.result);
				else reject(new Error(event.data.error));
			};
			active.addEventListener('message', onMessage);

			const request: WorkerRequest = { id, bytes };
			// Second argument is the TRANSFER list: it moves the buffer instead of
			// structured-cloning it. On a 20 MB photo that is the difference between
			// a copy and a pointer hand-off — the most-missed part of the API.
			active.postMessage(request, [bytes]);
		});

		workerResult = result;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		// Same two-frame wait as the main-thread lane, so both are measured identically
		// and the comparison stays honest.
		await nextFrame();
		await nextFrame();
		workerJank = Math.round(peakFrameMs);
		running = null;
	}
}
</script>

<div class="demo">
	{#if !supported}
		<p class="note">{m.showcase_workers_thread_unsupported()}</p>
	{:else}
		<label
			class="drop-zone"
			class:drag-over={dragOver}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
		>
			<input type="file" class="file-input" accept="image/*" onchange={handleSelect} />
			<span class="i-lucide-image-plus drop-icon"></span>
			<span class="drop-text">{m.showcase_workers_thread_drop()}</span>
			<span class="drop-hint">{m.showcase_workers_thread_drop_hint()}</span>
		</label>

		{#if error}
			<p class="error-text">{error}</p>
		{/if}

		{#if file}
			<div class="stage">
				{#if previewUrl}
					<img src={previewUrl} alt="" class="preview" />
				{/if}

				<div class="controls">
					<!-- The probe. It is driven by requestAnimationFrame, so it stops dead
					     whenever the main thread is blocked — no instrumentation needed. -->
					<div class="probe">
						<span
							class="probe-dial"
							class:stalled={running === 'main'}
							style="transform: rotate({spinnerAngle}deg)"
						></span>
						<span class="probe-label">{m.showcase_workers_thread_probe()}</span>
					</div>

					<div class="buttons">
						<Button variant="outline" disabled={running !== null} onclick={runOnMainThread}>
							{m.showcase_workers_thread_run_main()}
						</Button>
						<Button disabled={running !== null} onclick={runInWorker}>
							{m.showcase_workers_thread_run_worker()}
						</Button>
					</div>
				</div>
			</div>

			<div class="results">
				{#each [{ key: 'main', label: m.showcase_workers_thread_lane_main(), result: mainResult, jank: mainJank }, { key: 'worker', label: m.showcase_workers_thread_lane_worker(), result: workerResult, jank: workerJank }] as lane (lane.key)}
					<div class="lane" class:is-running={running === lane.key}>
						<h3 class="lane-title">{lane.label}</h3>

						{#if lane.result}
							<dl class="metrics">
								<div class="metric">
									<dt>{m.showcase_workers_thread_metric_work()}</dt>
									<dd>{lane.result.durationMs} ms</dd>
								</div>
								<!-- Committed two frames after the result — render only once it exists,
								     or the label flashes with an empty value. -->
								{#if lane.jank !== null}
									<div class="metric">
										<dt>{m.showcase_workers_thread_metric_jank()}</dt>
										<dd class:bad={lane.jank > SMOOTH_FRAME_MS}>{lane.jank} ms</dd>
									</div>
								{/if}
							</dl>

							<div class="swatches">
								{#each lane.result.swatches as swatch (swatch.hex)}
									<span
										class="swatch"
										style="background: {swatch.hex}; flex-grow: {Math.max(swatch.share, 0.05)}"
										title="{swatch.hex} · {Math.round(swatch.share * 100)}%"
									></span>
								{/each}
							</div>
						{:else}
							<p class="lane-empty">{m.showcase_workers_thread_lane_empty()}</p>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Suppressed when neither lane sampled a frame (hidden tab): "0 vs 0" would
			     read as a disproven claim rather than as an absence of measurement. -->
			{#if mainJank !== null && workerJank !== null && (mainJank > 0 || workerJank > 0)}
				<p class="verdict">
					{m.showcase_workers_thread_verdict({ main: String(mainJank), worker: String(workerJank) })}
				</p>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.note,
	.error-text,
	.lane-empty,
	.verdict {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.error-text {
		color: var(--color-error);
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-7) var(--spacing-4);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: border-color var(--duration-fast), background var(--duration-fast);
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.file-input {
		display: none;
	}

	.drop-icon {
		width: 1.75rem;
		height: 1.75rem;
		color: var(--color-muted);
	}

	.drop-text {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.drop-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-4);
	}

	.preview {
		width: 7rem;
		height: 7rem;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		flex: 1 1 16rem;
	}

	.probe {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.probe-dial {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
	}

	.probe-dial.stalled {
		border-top-color: var(--color-error);
	}

	.probe-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.results {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
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

	.lane.is-running {
		border-color: var(--color-primary);
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

	.metric dt {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.metric dd {
		margin: 0;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.metric dd.bad {
		color: var(--color-error);
	}

	.swatches {
		display: flex;
		height: 2rem;
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.swatch {
		flex-basis: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.probe-dial {
			transform: none !important;
		}
	}
</style>
