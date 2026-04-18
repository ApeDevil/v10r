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

const cycle = createCycleState('ai');
let submitting = $state(false);
let browserStart = 0;
let lastTrace = $state<CycleTrace | null>(null);
let answer = $state<string | null>(null);
let errorMessage = $state<string | null>(null);

let query = $state('What is Velociraptor?');
let selectedError = $state('');

const errorOptions = [
	{ value: '', label: 'None (happy path)' },
	{ value: 'embed', label: 'Embed error' },
	{ value: 'retrieve', label: 'Retrieve error' },
	{ value: 'generate', label: 'LLM timeout' },
];

function handleSubmit() {
	return async ({ result }: { result: ActionResult; update: () => Promise<void> }) => {
		submitting = false;
		const browserEnd = performance.now();

		if (result.type === 'success' && result.data) {
			const data = result.data as {
				trace: CycleTrace;
				success: boolean;
				error?: string;
				answer?: string;
			};
			if (data.trace) {
				lastTrace = data.trace;
				const roundTrip = browserEnd - browserStart;
				const serverMs = data.trace.totalDurationMs ?? 0;
				const browserMs = Math.max(0.5, Math.min(5, (roundTrip - serverMs) * 0.1));
				cycle.animateTrace(data.trace, browserMs, roundTrip);

				if (data.success) {
					answer = data.answer ?? null;
					errorMessage = null;
				} else {
					errorMessage = data.error ?? 'AI cycle failed';
					answer = null;
				}
			}
		}
		await invalidateAll();
	};
}
</script>

<svelte:head>
	<title>AI Cycle - Request Cycle - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">AI Pipeline Cycle</h2>
			<p class="text-fluid-sm text-muted">
				Watch the full RAG lifecycle: embed → retrieve → rank → context → generate → stream.
				<code>generate</code> typically dominates the waterfall — that's the teaching moment.
			</p>
		{/snippet}

		<form
			method="POST"
			action="?/run"
			use:enhance={() => {
				cycle.reset();
				browserStart = performance.now();
				submitting = true;
				answer = null;
				errorMessage = null;
				return handleSubmit();
			}}
		>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField label="Query">
					{#snippet children({ fieldId })}
						<Input
							id={fieldId}
							name="query"
							bind:value={query}
							placeholder="Ask something..."
						/>
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
						Run AI Cycle
					</Button>
				</div>
			</div>
		</form>

		{#if answer}
			<Alert variant="info" title="Answer">
				{#snippet children()}<p class="whitespace-pre-wrap">{answer}</p>{/snippet}
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
