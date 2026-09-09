<script lang="ts">
import { apiFetch } from '$lib/api';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { VelocityMeasurement, VelocityMeasurementId } from '$lib/showcases/velocity/measurement';

interface Props {
	id: VelocityMeasurementId;
	title: string;
	intro: string;
	/** Set by the parent's "run everything" button; each card runs its own request. */
	runToken?: number;
}

let { id, title, intro, runToken = 0 }: Props = $props();

let result = $state<VelocityMeasurement | null>(null);
let running = $state(false);
let failure = $state<string | null>(null);
let lastToken = 0;

export async function run(): Promise<void> {
	if (running) return;
	running = true;
	failure = null;
	try {
		// Not `fetch`: a bare call to /api/ is CSRF-rejected (see api.gate.test.ts).
		const response = await apiFetch(`/api/showcases/velocity?id=${id}`, { method: 'POST' });
		result = (await response.json()).data as VelocityMeasurement;
	} catch (cause) {
		failure = cause instanceof Error ? cause.message : String(cause);
	} finally {
		running = false;
	}
}

$effect(() => {
	if (runToken > lastToken) {
		lastToken = runToken;
		void run();
	}
});

/** Bar width relative to the slower arm, so the two are visually comparable. */
function share(ms: number, other: number): string {
	const max = Math.max(ms, other, 1);
	return `${Math.max(2, Math.round((ms / max) * 100))}%`;
}
</script>

<Stack gap="3">
	<p class="text-muted text-fluid-sm">{intro}</p>

	<div class="run">
		<Button variant="outline" size="sm" onclick={run} disabled={running}>
			{running ? m.showcase_velocity_running() : m.showcase_velocity_run()}
		</Button>
		{#if running}<Spinner size="sm" />{/if}
	</div>

	{#if failure}
		<p class="failure">{m.showcase_velocity_measure_failed({ reason: failure })}</p>
	{/if}

	{#if result}
		<table class="arms" aria-label={title}>
			<thead>
				<tr>
					<th scope="col">{m.showcase_velocity_col_arm()}</th>
					<th scope="col" class="num">{m.showcase_velocity_col_ms()}</th>
					<th scope="col" class="num">{m.showcase_velocity_col_calls()}</th>
					<th scope="col" class="bar-col"></th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row"><Badge variant="secondary">{m.showcase_velocity_arm_naive()}</Badge> {result.naive.label}</th>
					<td class="num">{result.naive.ms}</td>
					<td class="num">{result.naive.originCalls}</td>
					<td class="bar-col">
						<span class="bar naive" style:width={share(result.naive.ms, result.velocity.ms)}></span>
					</td>
				</tr>
				<tr>
					<th scope="row">
						<Badge variant="success">{m.showcase_velocity_arm_velocity()}</Badge>
						{result.velocity.label}
					</th>
					<td class="num">{result.velocity.ms}</td>
					<td class="num">{result.velocity.originCalls}</td>
					<td class="bar-col">
						<span class="bar velocity" style:width={share(result.velocity.ms, result.naive.ms)}></span>
					</td>
				</tr>
			</tbody>
		</table>

		<ul class="detail">
			{#each result.detail as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	{/if}
</Stack>

<style>
.run {
	display: flex;
	align-items: center;
	gap: var(--spacing-2);
}

.failure {
	font-size: var(--text-fluid-sm);
	color: var(--color-error);
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

.bar-col {
	width: 40%;
	min-width: 6rem;
}

.bar {
	display: block;
	height: 0.5rem;
	border-radius: var(--radius-sm);
}

.bar.naive {
	background-color: var(--color-muted);
}

.bar.velocity {
	background-color: var(--color-primary);
}

.detail {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-1);
	padding-left: var(--spacing-4);
	max-width: 72ch;
}

.detail li {
	list-style: disc;
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}
</style>
