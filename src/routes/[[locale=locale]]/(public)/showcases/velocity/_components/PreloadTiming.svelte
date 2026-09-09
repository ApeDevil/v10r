<script lang="ts">
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import { preloadNow } from '$lib/nav';
import * as m from '$lib/paraglide/messages';

/**
 * What a navigation's data fetch costs, with and without a preload having already run.
 *
 * `preloadData` is exactly the work a navigation does before it can render, so timing it
 * IS timing that half of the navigation — and timing it a second time on the same URL is
 * what a preloaded navigation pays, because SvelteKit already has the result.
 *
 * The cold arm uses a fresh query string each run so it is genuinely cold: `preloadData`
 * is keyed by URL, and re-measuring one the router has already resolved would measure the
 * cache both times and report a difference of zero.
 */
const TARGET = '/showcases/velocity/overview';

interface Reading {
	coldMs: number;
	warmMs: number;
}

let reading = $state<Reading | null>(null);
let running = $state(false);

async function measure(): Promise<void> {
	running = true;
	try {
		const cold = `${TARGET}?probe=${crypto.randomUUID()}`;
		const t0 = performance.now();
		await preloadNow(cold, 'code-data');
		const coldMs = performance.now() - t0;

		// Warm the second URL, then time a repeat of it — the preloaded case.
		const warm = `${TARGET}?probe=${crypto.randomUUID()}`;
		await preloadNow(warm, 'code-data');
		const t1 = performance.now();
		await preloadNow(warm, 'code-data');
		const warmMs = performance.now() - t1;

		reading = { coldMs: Math.round(coldMs), warmMs: Math.round(warmMs) };
	} finally {
		running = false;
	}
}
</script>

<Stack gap="3">
	<div class="run">
		<Button variant="outline" size="sm" onclick={measure} disabled={running}>
			{running ? m.showcase_velocity_running() : m.showcase_velocity_preload_measure()}
		</Button>
		{#if running}<Spinner size="sm" />{/if}
	</div>

	{#if reading}
		<table class="arms">
			<thead>
				<tr>
					<th scope="col">{m.showcase_velocity_col_arm()}</th>
					<th scope="col" class="num">{m.showcase_velocity_col_ms()}</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row">
						<Badge variant="secondary">{m.showcase_velocity_arm_naive()}</Badge>
						{m.showcase_velocity_preload_cold()}
					</th>
					<td class="num">{reading.coldMs}</td>
				</tr>
				<tr>
					<th scope="row">
						<Badge variant="success">{m.showcase_velocity_arm_velocity()}</Badge>
						{m.showcase_velocity_preload_warm()}
					</th>
					<td class="num">{reading.warmMs}</td>
				</tr>
			</tbody>
		</table>
		<p class="text-muted text-fluid-xs">{m.showcase_velocity_preload_timing_note()}</p>
	{/if}
</Stack>

<style>
.run {
	display: flex;
	align-items: center;
	gap: var(--spacing-2);
}

.arms {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-fluid-sm);
}

.arms th,
.arms td {
	padding: var(--spacing-2);
	text-align: left;
	border-bottom: 1px solid var(--color-border);
	font-weight: 400;
}

.arms thead th {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}

.arms .num {
	text-align: right;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}
</style>
