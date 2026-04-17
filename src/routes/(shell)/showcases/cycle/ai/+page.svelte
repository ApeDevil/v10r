<script lang="ts">
	import { Alert, Card } from '$lib/components/composites';
	import { Stack } from '$lib/components/layout';
	import { Button } from '$lib/components/primitives';
	import { CyclePipeline, CycleWaterfall } from '$lib/components/cycle';
	import { createCycleState } from '$lib/components/cycle/cycle-state.svelte';
	import type { CycleTrace } from '$lib/components/cycle/types';

	const cycle = createCycleState();
	let lastTrace = $state<CycleTrace | null>(null);

	/**
	 * Simulates an AI pipeline cycle with realistic timing.
	 * In the full implementation, this would connect to /api/ai/chat
	 * and read pipeline events from message-metadata annotations.
	 */
	function runAiCycle() {
		cycle.reset();

		// Simulate an AI RAG pipeline trace
		const trace: CycleTrace = {
			id: crypto.randomUUID(),
			trigger: 'ai',
			spans: [
				{ stage: 'server', status: 'done', startMs: 0, durationMs: 3, detail: { action: 'auth + parse' } },
				{ stage: 'domain', status: 'done', startMs: 3, durationMs: 45, detail: { steps: ['embed', 'retrieve', 'rank', 'context'] } },
				{ stage: 'database', status: 'done', startMs: 8, durationMs: 35, detail: { operation: 'vector search + graph traversal' } },
				{ stage: 'response', status: 'done', startMs: 48, durationMs: 120, detail: { streaming: true, model: 'claude-sonnet-4-6', tokens: 284 } },
			],
			totalDurationMs: 168,
			inputPayload: { query: 'What is Velociraptor?' },
			outputPayload: { tokens: 284, model: 'claude-sonnet-4-6' },
		};

		lastTrace = trace;
		cycle.animateTrace(trace, performance.now(), 12);
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
				Visualize the RAG pipeline lifecycle: query → embedding → retrieval → ranking → LLM generation → streamed response.
			</p>
		{/snippet}

		<div class="flex items-center gap-4">
			<code class="text-fluid-sm text-muted flex-1 p-3 rounded-md bg-surface-1">
				"What is Velociraptor?"
			</code>
			<Button onclick={runAiCycle} disabled={cycle.mode === 'running'}>
				Run AI Cycle
			</Button>
		</div>

		<Alert variant="info" title="Simulated Pipeline">
			{#snippet children()}
				<p>
					This demonstrates the visualization with simulated timing data. The full implementation
					connects to <code>/api/ai/chat</code> and reads pipeline events from <code>message-metadata</code>
					annotations via the existing RAG infrastructure.
				</p>
			{/snippet}
		</Alert>
	</Card>

	<!-- Visualization Zone -->
	{#if cycle.mode !== 'idle'}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-sm font-semibold">Pipeline</h3>
				{/snippet}
				<CyclePipeline stages={cycle.stages} onselect={cycle.selectStage} />
			</Card>

			<Card>
				{#snippet header()}
					<div class="flex items-center justify-between">
						<h3 class="text-fluid-sm font-semibold">Waterfall</h3>
						{#if cycle.totalDurationMs > 0}
							<span class="text-fluid-xs text-muted font-mono">
								{Math.round(cycle.totalDurationMs * 100) / 100}ms
							</span>
						{/if}
					</div>
				{/snippet}
				<CycleWaterfall
					stages={cycle.stages}
					totalDurationMs={cycle.totalDurationMs}
					onselect={cycle.selectStage}
				/>
			</Card>
		</div>
	{/if}
</Stack>
