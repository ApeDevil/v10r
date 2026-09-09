<script lang="ts">
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner, Switch } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { OptimisticValue } from '$lib/state/optimistic.svelte';

/** Artificial server latency, in ms. Stated on the page — nothing here hides it. */
const LATENCY = 500;

interface Task {
	id: string;
	label: string;
	done: boolean;
}

const seed = (): Task[] => [
	{ id: 't1', label: m.showcase_velocity_task_one(), done: false },
	{ id: 't2', label: m.showcase_velocity_task_two(), done: true },
	{ id: 't3', label: m.showcase_velocity_task_three(), done: false },
];

let failNext = $state(false);
let commits = $state(0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The one simulated part: a server that takes LATENCY ms and can be told to refuse. */
async function server(): Promise<void> {
	commits++;
	await sleep(LATENCY);
	if (failNext) throw new Error(m.showcase_velocity_optimistic_server_error());
}

const toggle = (id: string) => (tasks: Task[]) => tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));

// ── Naive arm: the interface waits for the round trip ────────────────────────
let naive = $state<Task[]>(seed());
let naiveBusy = $state<string | null>(null);

async function toggleNaive(id: string): Promise<void> {
	naiveBusy = id;
	try {
		await server();
		naive = toggle(id)(naive);
	} catch {
		// Nothing to roll back — nothing was applied.
	} finally {
		naiveBusy = null;
	}
}

// ── Velocity arm: the interface applies the intent, the server catches up ────
let optimistic = $state(new OptimisticValue<Task[]>(seed()));

function toggleOptimistic(id: string): void {
	void optimistic.mutate({ key: `toggle:${id}`, apply: toggle(id), commit: server });
}

/** Fires the SAME intent twice in the same tick, the way a double-click does. */
function doubleClick(): void {
	const before = commits;
	const id = 't1';
	void optimistic.mutate({ key: `toggle:${id}`, apply: toggle(id), commit: server });
	void optimistic.mutate({ key: `toggle:${id}`, apply: toggle(id), commit: server });
	doubleClickResult = m.showcase_velocity_optimistic_double_result({ issued: 2, ran: commits - before });
}

let doubleClickResult = $state('');

function reset(): void {
	naive = seed();
	optimistic = new OptimisticValue<Task[]>(seed());
	commits = 0;
	doubleClickResult = '';
	failNext = false;
}
</script>

<Stack gap="4">
	<div class="controls">
		<Switch bind:checked={failNext} label={m.showcase_velocity_optimistic_fail_label()} />
		<Button variant="outline" size="sm" onclick={doubleClick}>
			{m.showcase_velocity_optimistic_double_button()}
		</Button>
		<Button variant="ghost" size="sm" onclick={reset}>{m.showcase_velocity_reset()}</Button>
	</div>

	{#if doubleClickResult}
		<p class="result">{doubleClickResult}</p>
	{/if}

	<div class="arms">
		<section class="arm">
			<header>
				<h3>{m.showcase_velocity_optimistic_naive_title()}</h3>
				<p>{m.showcase_velocity_optimistic_naive_note({ ms: LATENCY })}</p>
			</header>
			<ul>
				{#each naive as task (task.id)}
					<li>
						<Button
							variant={task.done ? 'secondary' : 'outline'}
							size="sm"
							disabled={naiveBusy !== null}
							onclick={() => toggleNaive(task.id)}
						>
							{task.done ? '✓' : '○'}
							{task.label}
						</Button>
						{#if naiveBusy === task.id}
							<Spinner size="sm" />
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="arm">
			<header>
				<h3>{m.showcase_velocity_optimistic_velocity_title()}</h3>
				<p>{m.showcase_velocity_optimistic_velocity_note({ ms: LATENCY })}</p>
			</header>
			<ul>
				{#each optimistic.current as task (task.id)}
					<li>
						<Button
							variant={task.done ? 'secondary' : 'outline'}
							size="sm"
							onclick={() => toggleOptimistic(task.id)}
						>
							{task.done ? '✓' : '○'}
							{task.label}
						</Button>
						{#if optimistic.isPending(`toggle:${task.id}`)}
							<Badge variant="warning">{m.showcase_velocity_optimistic_pending()}</Badge>
						{/if}
					</li>
				{/each}
			</ul>
			{#if optimistic.error}
				<p class="error">{m.showcase_velocity_optimistic_rolled_back({ reason: optimistic.error.message })}</p>
			{/if}
		</section>
	</div>

	<p class="text-muted text-fluid-sm">{m.showcase_velocity_optimistic_caveat()}</p>
</Stack>

<style>
.controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--spacing-3);
}

.arms {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--spacing-4);
}

.arm {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3);
	padding: var(--spacing-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
}

.arm h3 {
	font-size: var(--text-fluid-base);
	font-weight: 600;
}

.arm header p {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}

.arm ul {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2);
}

.arm li {
	display: flex;
	align-items: center;
	gap: var(--spacing-2);
	min-height: 2.25rem;
}

.result,
.error {
	font-size: var(--text-fluid-sm);
}

.error {
	color: var(--color-error);
}

@media (width < 48rem) {
	.arms {
		grid-template-columns: 1fr;
	}
}
</style>
