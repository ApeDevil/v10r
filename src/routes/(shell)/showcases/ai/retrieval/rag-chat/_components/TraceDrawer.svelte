<script lang="ts">
import { CSRF_HEADER } from '$lib/api';
import { Drawer } from '$lib/components/primitives';
import { type LlmwikiTraceState, WikiTrace } from './llmwiki';
import { type RawragTraceState, RawragTrace } from './rawrag';

interface Props {
	open: boolean;
	rawrag: RawragTraceState;
	llmwiki: LlmwikiTraceState;
	isLlmwiki: boolean;
	lastUserMessage: string;
}

let { open = $bindable(), rawrag, llmwiki, isLlmwiki, lastUserMessage }: Props = $props();

const assembledPrompt = $derived(isLlmwiki ? llmwiki.assembledPrompt : rawrag.assembledPrompt);

let promptOpen = $state(false);
let counterfactualLoading = $state(false);
let counterfactualText = $state<string | null>(null);
let counterfactualError = $state<string | null>(null);

async function runCounterfactual() {
	if (!lastUserMessage || counterfactualLoading) return;
	counterfactualLoading = true;
	counterfactualText = '';
	counterfactualError = null;
	try {
		const res = await fetch('/api/ai/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
			body: JSON.stringify({
				messages: [{ role: 'user', content: lastUserMessage }],
				useRetrieval: false,
			}),
		});
		if (!res.ok || !res.body) {
			counterfactualError = `HTTP ${res.status}`;
			counterfactualLoading = false;
			return;
		}
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		// Parse SSE-style UIMessage stream and accumulate text parts.
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const raw = decoder.decode(value, { stream: true });
			for (const line of raw.split('\n')) {
				if (!line.startsWith('data:')) continue;
				const payload = line.slice(5).trim();
				if (!payload || payload === '[DONE]') continue;
				try {
					const obj = JSON.parse(payload) as { type?: string; delta?: string; text?: string };
					if (obj.type === 'text-delta' && typeof obj.delta === 'string') {
						counterfactualText = (counterfactualText ?? '') + obj.delta;
					} else if (obj.type === 'text' && typeof obj.text === 'string') {
						counterfactualText = obj.text;
					}
				} catch {
					// ignore non-JSON frames
				}
			}
		}
	} catch (err) {
		counterfactualError = err instanceof Error ? err.message : 'Request failed';
	} finally {
		counterfactualLoading = false;
	}
}

function resetCounterfactual() {
	counterfactualText = null;
	counterfactualError = null;
}
</script>

<Drawer bind:open side="right" title="Retrieval Trace">
	<div class="drawer-body">
		<section class="section">
			<h3 class="section-title">Pipeline steps</h3>
			{#if isLlmwiki}
				<WikiTrace trace={llmwiki} />
			{:else}
				<RawragTrace pipeline={rawrag} />
			{/if}
		</section>

		{#if assembledPrompt}
			<section class="section">
				<button
					type="button"
					class="collapsible-head"
					aria-expanded={promptOpen}
					onclick={() => {
						promptOpen = !promptOpen;
					}}
				>
					<span class="i-lucide-chevron-right h-3 w-3 chev" class:open={promptOpen}></span>
					<h3 class="section-title inline">Assembled prompt</h3>
					<span class="token-pill">{assembledPrompt.totalTokens} ctx tokens</span>
				</button>

				{#if promptOpen}
					<div class="prompt-blocks">
						{#if assembledPrompt.systemPrompt}
							<div class="prompt-block">
								<span class="block-label">system</span>
								<pre class="prompt-text">{assembledPrompt.systemPrompt}</pre>
							</div>
						{:else if assembledPrompt.systemPromptHash}
							<div class="prompt-block">
								<span class="block-label">system (redacted)</span>
								<code class="hash">{assembledPrompt.systemPromptHash}</code>
							</div>
						{/if}
						<div class="prompt-block">
							<span class="block-label">user</span>
							<pre class="prompt-text">{assembledPrompt.userPrompt}</pre>
						</div>
					</div>
				{/if}
			</section>
		{/if}

		<section class="section">
			<h3 class="section-title">Counterfactual</h3>
			<p class="section-hint">
				Run the same question without RAG — compare to see how much the retrieved context changed the
				answer.
			</p>
			<div class="cf-actions">
				<button
					type="button"
					class="cf-btn"
					disabled={!lastUserMessage || counterfactualLoading}
					onclick={runCounterfactual}
				>
					{#if counterfactualLoading}
						<span class="i-lucide-loader-2 h-3 w-3 spin"></span>
						Running…
					{:else}
						<span class="i-lucide-play h-3 w-3"></span>
						Run without RAG
					{/if}
				</button>
				{#if counterfactualText || counterfactualError}
					<button type="button" class="cf-btn ghost" onclick={resetCounterfactual}>Clear</button>
				{/if}
			</div>

			{#if counterfactualError}
				<p class="cf-error">{counterfactualError}</p>
			{/if}
			{#if counterfactualText}
				<div class="cf-output">
					<span class="block-label">no-RAG response</span>
					<pre class="prompt-text">{counterfactualText}</pre>
				</div>
			{/if}
		</section>
	</div>
</Drawer>

<style>
	.drawer-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		padding: var(--spacing-4) 0;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.section-title {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.section-title.inline {
		text-transform: none;
		letter-spacing: 0;
	}

	.section-hint {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
	}

	.collapsible-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--color-fg);
	}

	.chev {
		transition: transform 150ms;
	}
	.chev.open {
		transform: rotate(90deg);
	}

	.token-pill {
		margin-left: auto;
		font-size: 10px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.prompt-blocks {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.prompt-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.block-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.prompt-text {
		margin: 0;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
		font-family: ui-monospace, monospace;
		font-size: 11px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 280px;
		overflow-y: auto;
	}

	.hash {
		font-family: ui-monospace, monospace;
		font-size: 11px;
		color: var(--color-muted);
	}

	.cf-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.cf-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-sm);
		background: var(--color-primary);
		color: var(--color-primary-fg, white);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.cf-btn.ghost {
		background: transparent;
		border-color: var(--color-border);
		color: var(--color-muted);
	}

	.cf-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.cf-error {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
		font-size: 12px;
	}

	.cf-output {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
</style>
