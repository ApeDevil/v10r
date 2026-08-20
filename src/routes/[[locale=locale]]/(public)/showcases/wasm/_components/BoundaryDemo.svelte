<script lang="ts">
/**
 * The boundary tax, made visible — the deliberate counter-example.
 *
 * One multiply per element over a million floats: almost no compute per byte.
 * Three lanes race on the main thread (each round is milliseconds — no worker
 * needed): plain JS, wasm whose &[f32] argument is copied across the boundary
 * every call, and wasm with the data resident in linear memory. The copied lane
 * losing to plain JS IS the exhibit — do not "fix" it.
 */
import { onMount } from 'svelte';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { formatMs, median } from '$lib/wasm/bench';
import { checksum, makeFloatData, scaleInPlace } from '$lib/wasm/filters';

const LEN = 1_000_000;
const WARMUP = 3;
const ROUNDS = 9;
const FACTOR = 1.5;

interface Lane {
	key: 'js' | 'copied' | 'resident';
	label: () => string;
	median: number;
	checksum: string;
}

let running = $state(false);
let error = $state<string | null>(null);
let lanes = $state<Lane[] | null>(null);

// SSR must stay neutral: the unsupported verdict only renders after mount,
// from the client's own capability check.
let mounted = $state(false);
onMount(() => {
	mounted = true;
});
const supported = typeof WebAssembly === 'object';
const maxMedian = $derived(lanes ? Math.max(...lanes.map((l) => l.median)) : 0);
const checksumsMatch = $derived(lanes !== null && new Set(lanes.map((l) => l.checksum)).size === 1);

function bytes(data: Float32Array): string {
	return checksum(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

async function run() {
	if (running) return;
	running = true;
	error = null;
	lanes = null;

	try {
		const { loadKernel } = await import('$lib/wasm');
		const kernel = await loadKernel();

		const jsData = makeFloatData(LEN);
		let copiedData = makeFloatData(LEN);
		const times = { js: [] as number[], copied: [] as number[], resident: [] as number[] };

		const resident = new kernel.mod.FloatKernel(LEN);
		try {
			new Float32Array(kernel.memory.buffer, resident.ptr(), LEN).set(makeFloatData(LEN));

			const runners = {
				js: () => scaleInPlace(jsData, FACTOR),
				copied: () => {
					copiedData = kernel.mod.scale_copied(copiedData, FACTOR);
				},
				resident: () => resident.scale(FACTOR),
			};
			// Counterbalanced, warm-up discarded — same protocol as the filter lab.
			// The lane order rotates each round so no lane always runs in the same
			// position; timings are stored by lane, not by position. ROUNDS is a
			// multiple of 3 so every lane sees every position equally often.
			const rotations: (keyof typeof runners)[][] = [
				['js', 'copied', 'resident'],
				['copied', 'resident', 'js'],
				['resident', 'js', 'copied'],
			];
			for (let i = 0; i < WARMUP + ROUNDS; i++) {
				for (const key of rotations[i % 3]) {
					const t0 = performance.now();
					runners[key]();
					const elapsed = performance.now() - t0;
					if (i >= WARMUP) times[key].push(elapsed);
				}
				// Yield between rounds so a slow device doesn't see one long main-thread stall.
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			const residentOut = new Float32Array(kernel.memory.buffer, resident.ptr(), LEN).slice();

			lanes = [
				{ key: 'js', label: m.showcase_wasm_boundary_lane_js, median: median(times.js), checksum: bytes(jsData) },
				{
					key: 'copied',
					label: m.showcase_wasm_boundary_lane_copied,
					median: median(times.copied),
					checksum: bytes(copiedData),
				},
				{
					key: 'resident',
					label: m.showcase_wasm_boundary_lane_resident,
					median: median(times.resident),
					checksum: bytes(residentOut),
				},
			];
		} finally {
			resident.free();
		}
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		running = false;
	}
}
</script>

<div class="demo">
	{#if !mounted}
		<p class="note">{m.showcase_wasm_lab_loading()}</p>
	{:else if !supported}
		<p class="note">{m.showcase_wasm_lab_unsupported()}</p>
	{:else}
		<Button variant="outline" onclick={run} disabled={running}>
			{m.showcase_wasm_boundary_run()}
		</Button>

		{#if error}
			<p class="error-text">{error}</p>
		{/if}

		{#if lanes}
			<div class="lanes">
				{#each lanes as lane (lane.key)}
					<div class="lane">
						<div class="lane-head">
							<span class="lane-label">{lane.label()}</span>
							<span class="lane-value">{formatMs(lane.median)} ms</span>
						</div>
						<div class="bar-track">
							<div
								class="bar"
								class:is-loser={lane.median === maxMedian}
								style="width: {maxMedian > 0 ? Math.max((lane.median / maxMedian) * 100, 2) : 0}%"
							></div>
						</div>
					</div>
				{/each}
			</div>

			<p class="verdict" class:bad={!checksumsMatch}>
				{#if checksumsMatch}
					{m.showcase_wasm_boundary_checksums()}
					{m.showcase_wasm_boundary_verdict({
						js: formatMs(lanes[0].median),
						copied: formatMs(lanes[1].median),
						resident: formatMs(lanes[2].median),
					})}
				{:else}
					{m.showcase_wasm_boundary_checksum_bad()}
				{/if}
			</p>
		{/if}
	{/if}
</div>

<style>
	.demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		align-items: flex-start;
	}

	.note,
	.error-text {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.error-text {
		color: var(--color-error);
	}

	.lanes {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		width: 100%;
		max-width: 34rem;
	}

	.lane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.lane-head {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.lane-label {
		font-size: var(--text-fluid-sm);
	}

	.lane-value {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.bar-track {
		height: 0.5rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-border) 50%, transparent);
		overflow: hidden;
	}

	.bar {
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		transition: width var(--duration-normal);
	}

	.bar.is-loser {
		background: var(--color-error);
	}

	.verdict {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-muted);
	}

	.verdict.bad {
		color: var(--color-error);
	}
</style>
