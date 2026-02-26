<script lang="ts">
	import { apiFetch } from '$lib/api';
	import { Card, Alert, BoundaryFallback } from '$lib/components/composites';
	import { Button, Typography } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data } = $props();

	const PRESETS = [
		'Explain recursion',
		'Write a haiku',
		'List 10 facts about TypeScript',
		'Describe how HTTP works',
	];

	let streaming = $state(false);
	let output = $state('');
	let error = $state('');

	// Metrics
	let ttft = $state<number | null>(null);
	let totalChunks = $state(0);
	let elapsed = $state(0);
	let tokensPerSec = $state(0);

	async function runPrompt(prompt: string) {
		// Reset state
		streaming = true;
		output = '';
		error = '';
		ttft = null;
		totalChunks = 0;
		elapsed = 0;
		tokensPerSec = 0;

		const startTime = performance.now();
		let firstTokenReceived = false;

		try {
			const res = await apiFetch('/api/ai/streaming', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt }),
			});

			if (!res.ok) {
				let errorDetail: string;
				try {
					const data = await res.json();
					errorDetail = data.error || `Error ${res.status}`;
				} catch {
					errorDetail = `Error ${res.status}`;
				}
				error = errorDetail;
				streaming = false;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) {
				error = 'No stream available';
				streaming = false;
				return;
			}

			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const now = performance.now();

				// Parse AI SDK data stream: text chunks start with "0:"
				const lines = chunk.split('\n');
				for (const line of lines) {
					if (line.startsWith('0:')) {
						try {
							const text = JSON.parse(line.slice(2));
							if (typeof text === 'string') {
								if (!firstTokenReceived) {
									ttft = Math.round(now - startTime);
									firstTokenReceived = true;
								}
								totalChunks++;
								output += text;

								elapsed = Math.round(now - startTime);
								tokensPerSec = elapsed > 0
									? Math.round((totalChunks / elapsed) * 1000)
									: 0;
							}
						} catch {
							// skip non-JSON lines
						}
					}
				}
			}

			elapsed = Math.round(performance.now() - startTime);
			if (totalChunks > 0 && elapsed > 0) {
				tokensPerSec = Math.round((totalChunks / elapsed) * 1000);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Stream failed';
		} finally {
			streaming = false;
		}
	}
</script>

<svelte:head>
	<title>Streaming - AI - Showcases - Velociraptor</title>
</svelte:head>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider in your <code>.env</code> file to enable streaming.</p>
				<p>See <a href="/showcases/ai/connection">Connection</a> for setup instructions.</p>
			</Alert>
		{:else}
			<svelte:boundary>
				{#if data.provider}
					<div class="stream-provider flex items-center gap-2 text-fluid-sm text-muted">
						<span class="i-lucide-cpu h-4 w-4"></span>
						<span>{data.provider.name}</span>
						<code class="stream-model">{data.provider.model}</code>
					</div>
				{/if}

				<!-- Prompt -->
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Prompt</Typography>
					{/snippet}

					<div class="stream-prompts" role="group" aria-label="Preset prompts">
						{#each PRESETS as preset}
							<Button
								variant="outline"
								size="sm"
								disabled={streaming}
								onclick={() => runPrompt(preset)}
							>
								{preset}
							</Button>
						{/each}
					</div>
				</Card>

				<!-- Output -->
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Output</Typography>
					{/snippet}

					{#if error}
						<div class="stream-error rounded-md px-3 py-2 text-fluid-sm" role="alert">
							{error}
						</div>
					{:else if output || streaming}
						<div class="stream-output">
							<span class="whitespace-pre-wrap">{output}</span>
							{#if streaming}
								<span class="stream-cursor"></span>
							{/if}
						</div>
					{:else}
						<p class="text-fluid-sm text-muted">Select a prompt to begin streaming.</p>
					{/if}
				</Card>

				<!-- Metrics -->
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Metrics</Typography>
					{/snippet}

					<div class="stream-metrics">
						<div class="stream-stat">
							<span class="stream-stat-label">TTFT</span>
							<span class="stream-stat-value">{ttft !== null ? `${ttft}ms` : '—'}</span>
						</div>
						<div class="stream-stat">
							<span class="stream-stat-label">Tokens/s</span>
							<span class="stream-stat-value">{tokensPerSec || '—'}</span>
						</div>
						<div class="stream-stat">
							<span class="stream-stat-label">Chunks</span>
							<span class="stream-stat-value">{totalChunks || '—'}</span>
						</div>
						<div class="stream-stat">
							<span class="stream-stat-label">Elapsed</span>
							<span class="stream-stat-value">{elapsed ? `${elapsed}ms` : '—'}</span>
						</div>
					</div>
				</Card>

				{#snippet failed(error, reset)}
					<BoundaryFallback
						title="AI streaming unavailable"
						description="The AI response stream was interrupted. Check your API key configuration."
						{reset}
					/>
				{/snippet}
			</svelte:boundary>
		{/if}
	</Stack>

<style>
	.stream-prompts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.stream-output {
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		white-space: pre-wrap;
		min-height: 100px;
		max-height: 400px;
		overflow-y: auto;
	}

	.stream-cursor {
		display: inline-block;
		width: 2px;
		height: 1em;
		vertical-align: text-bottom;
		background-color: var(--color-primary);
		animation: stream-blink 1s step-end infinite;
	}

	@keyframes stream-blink {
		50% { opacity: 0; }
	}

	.stream-error {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
	}

	.stream-metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--spacing-4);
	}

	.stream-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	.stream-stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stream-stat-value {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.stream-model {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.stream-provider {
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background-color: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}
</style>
