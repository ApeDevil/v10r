<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { Alert, Card, FormField } from '$lib/components/composites';
import { CycleDetail, CyclePipeline, CycleVizCard, CycleWaterfall } from '$lib/components/cycle';
import { createCycleState } from '$lib/components/cycle/cycle-state.svelte';
import type { CycleTrace } from '$lib/components/cycle/types';
import { Stack } from '$lib/components/layout';
import { Button, Input, Select, Spinner } from '$lib/components/primitives';

const cycle = createCycleState('default');
let submitting = $state(false);
let browserStart = 0;
let lastTrace = $state<CycleTrace | null>(null);
let resultMessage = $state<string | null>(null);
let errorMessage = $state<string | null>(null);

let label = $state('API Call');
let selectedError = $state('');

const errorOptions = [
	{ value: '', label: 'None (happy path)' },
	{ value: 'validation', label: 'Validation error' },
	{ value: 'domain', label: 'Domain error' },
	{ value: 'db', label: 'Database error' },
];

function handleSubmit() {
	return async ({ result, update: _u }: { result: ActionResult; update: () => Promise<void> }) => {
		submitting = false;
		const browserEnd = performance.now();

		if (result.type === 'success' && result.data) {
			const { trace, success, error } = result.data as {
				trace: CycleTrace;
				success: boolean;
				error?: string;
			};
			if (trace) {
				lastTrace = trace;
				const roundTrip = browserEnd - browserStart;
				const serverMs = trace.totalDurationMs ?? 0;
				const browserMs = Math.max(0.5, Math.min(5, (roundTrip - serverMs) * 0.1));
				cycle.animateTrace(trace, browserMs, roundTrip);

				if (success) {
					resultMessage = `API cycle completed in ${Math.round(serverMs)}ms (round-trip ${Math.round(roundTrip)}ms)`;
				} else {
					errorMessage = error ?? 'Cycle failed';
				}
			}
		}
		await invalidateAll();
	};
}
</script>
<Stack gap="6">
	<!-- Trigger Zone -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">API Route Cycle</h2>
			<p class="text-fluid-sm text-muted">
				Trigger a cycle via a named form action, demonstrating the fetch-based API pattern.
			</p>
		{/snippet}

		<form
			method="POST"
			action="?/run"
			use:enhance={() => {
				cycle.reset();
				browserStart = performance.now();
				submitting = true;
				resultMessage = null;
				errorMessage = null;
				return handleSubmit();
			}}
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField label="Label">
					{#snippet children({ fieldId })}
						<Input id={fieldId} name="label" bind:value={label} placeholder="e.g. API Call" />
					{/snippet}
				</FormField>

				<FormField label="Simulate Error">
					{#snippet children()}
						<Select options={errorOptions} bind:value={selectedError} />
						<input type="hidden" name="simulateError" value={selectedError} />
					{/snippet}
				</FormField>

				<div class="flex items-end">
					<Button type="submit" disabled={submitting} class="w-full">
						{#if submitting}<Spinner size="sm" class="mr-2" />{/if}
						Run API Cycle
					</Button>
				</div>
			</div>
		</form>

		{#if resultMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}<p>{resultMessage}</p>{/snippet}
			</Alert>
		{/if}
		{#if errorMessage}
			<Alert variant="error" title="Cycle Error">
				{#snippet children()}<p>{errorMessage}</p>{/snippet}
			</Alert>
		{/if}
	</Card>

	<!-- Visualization Zone — always visible -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
		<CycleVizCard title="Pipeline" subtitle="order & status">
			<CyclePipeline
				stages={cycle.stages}
				selectedStageId={cycle.selectedStageId}
				onselect={cycle.selectStage}
			/>
		</CycleVizCard>

		<CycleVizCard
			title="Waterfall"
			subtitle={cycle.totalDurationMs > 0
				? `${Math.round(cycle.totalDurationMs * 100) / 100}ms total`
				: 'relative timing'}
		>
			<CycleWaterfall
				stages={cycle.stages}
				totalDurationMs={cycle.totalDurationMs}
				selectedStageId={cycle.selectedStageId}
				onselect={cycle.selectStage}
			/>
		</CycleVizCard>
	</div>

	<!-- Detail Zone -->
	{#if cycle.selectedStage && lastTrace}
		<CycleDetail
			stage={cycle.selectedStage}
			trace={lastTrace}
			totalDurationMs={cycle.totalDurationMs}
			onclose={() => cycle.selectStage(null)}
		/>
	{/if}
</Stack>
