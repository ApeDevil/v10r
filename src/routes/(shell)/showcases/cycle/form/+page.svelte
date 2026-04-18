<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { Alert, Card, FormField } from '$lib/components/composites';
	import { Stack } from '$lib/components/layout';
	import { Button, Input, Select, Spinner } from '$lib/components/primitives';
	import { cycleSchema } from '$lib/schemas/showcase/cycle';
	import { CycleDetail, CyclePipeline, CycleVizCard, CycleWaterfall } from '$lib/components/cycle';
	import { createCycleState } from '$lib/components/cycle/cycle-state.svelte';
	import type { CycleSpan, CycleTrace } from '$lib/components/cycle/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const cycle = createCycleState('default');
	let browserStart = 0;
	let browserEnd = 0;
	let lastTrace = $state<CycleTrace | null>(null);
	let resultMessage = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);

	const errorOptions = [
		{ value: '', label: 'None (happy path)' },
		{ value: 'validation', label: 'Validation error' },
		{ value: 'domain', label: 'Domain error' },
		{ value: 'db', label: 'Database error' },
	];

	// svelte-ignore state_referenced_locally
	const { form, errors, enhance, submitting, delayed } = superForm(data.form, {
		validators: valibotClient(cycleSchema),
		onSubmit() {
			cycle.reset();
			browserStart = performance.now();
			resultMessage = null;
			errorMessage = null;
		},
		onResult({ result }) {
			browserEnd = performance.now();
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
						resultMessage = `Cycle completed in ${Math.round(serverMs)}ms (round-trip ${Math.round(roundTrip)}ms)`;
					} else {
						errorMessage = error ?? 'Cycle failed';
					}
				}
			}
		},
	});

	function replayHistory(traceData: string) {
		if (!traceData) return;
		try {
			const entry = JSON.parse(traceData);
			const spans = (entry.spans ?? []) as CycleSpan[];
			if (spans.length === 0) {
				resultMessage = `Run #${entry.id} — ${entry.status} (${entry.totalDurationMs ?? 0}ms, no span data)`;
				return;
			}
			const trace: CycleTrace = {
				id: String(entry.id),
				trigger: entry.trigger,
				spans,
				totalDurationMs: entry.totalDurationMs,
				inputPayload: entry.inputPayload,
				outputPayload: entry.outputPayload,
			};
			lastTrace = trace;
			// Replay without client-side browser/network spans (historical; we never measured them).
			cycle.animateTrace(trace);
			resultMessage =
				entry.status === 'success'
					? `Replaying Run #${entry.id} (${entry.totalDurationMs ?? 0}ms)`
					: null;
			errorMessage =
				entry.status === 'error' ? `Replaying Run #${entry.id} — ${entry.errorMessage}` : null;
		} catch {
			// ignore
		}
	}

	let selectedError = $state('');
</script>

<svelte:head>
	<title>Form Cycle - Request Cycle - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Trigger Zone -->
	<Card>
		{#snippet header()}
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-fluid-lg font-semibold">Form Action Cycle</h2>
					<p class="text-fluid-sm text-muted">
						Submit a form and watch the request flow through SvelteKit's form action pipeline.
					</p>
				</div>
				{#if data.history.length > 0}
					<Select
						options={data.history.map((h) => ({
							value: JSON.stringify(h),
							label: `#${h.id} — ${h.status} (${h.totalDurationMs ?? 0}ms)`,
						}))}
						placeholder="History"
						onchange={replayHistory}
						class="w-48"
					/>
				{/if}
			</div>
		{/snippet}

		<form method="POST" use:enhance class="form-grid">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<FormField label="Label" error={$errors.label?.[0]} required>
					{#snippet children({ fieldId, describedBy })}
						<Input
							id={fieldId}
							name="label"
							bind:value={$form.label}
							placeholder="e.g. Test Run"
							error={!!$errors.label}
							aria-describedby={describedBy}
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
					<Button type="submit" disabled={$submitting} class="w-full">
						{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
						Run Cycle
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

	<!-- Visualization Zone — always visible; ghost pills invite interaction -->
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

<style>
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
