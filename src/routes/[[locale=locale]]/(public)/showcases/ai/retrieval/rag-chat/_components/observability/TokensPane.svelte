<!--
  Tokens pane. Two STRUCTURAL sections so the estimate/measure boundary is unmissable:
   - Measured: provider usage only (input/output/reasoning/cached/embedding) — no ~.
   - ~Estimated (chars/4): system prompt + context + the derived base-system / overhead (~).
  Absorbs the assembled-prompt block (collapsed). Cross-panel: a single DOM-only $effect
  highlights + scrolls the rows whose phase matches the selected step — no state write-back.
-->
<script lang="ts">
import type { NragTraceState } from '../trace/nrag-trace.svelte';

interface Props {
	trace: NragTraceState;
}

let { trace }: Props = $props();

const tb = $derived(trace.tokenBreakdown);
const prompt = $derived(trace.assembledPrompt);

let promptOpen = $state(false);
let listEl: HTMLDivElement | undefined = $state();

/** Cross-panel: highlight + scroll the rows that belong to the selected step's phase. */
$effect(() => {
	const phase = trace.selectedStep?.phase;
	const root = listEl;
	if (!root) return;
	for (const el of root.querySelectorAll('[data-phase]')) {
		el.classList.remove('row-highlight');
	}
	if (!phase) return;
	const matches = root.querySelectorAll(`[data-phase="${phase}"]`);
	matches.forEach((el, i) => {
		el.classList.add('row-highlight');
		if (i === 0) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});
});
</script>

<div class="tokens-pane">
	{#if !tb}
		<p class="empty">Token usage appears after the answer completes.</p>
	{:else}
		<div class="token-list" bind:this={listEl}>
			<section class="token-section">
				<h4 class="section-head">Measured</h4>
				<dl class="rows">
					{#if tb.inputTokensReal != null}
						<div class="row" data-phase="generate"><dt>Input</dt><dd>{tb.inputTokensReal}</dd></div>
					{/if}
					{#if tb.outputTokensReal != null}
						<div class="row" data-phase="generate"><dt>Output</dt><dd>{tb.outputTokensReal}</dd></div>
					{/if}
					{#if tb.reasoningTokensReal != null}
						<div class="row sub" data-phase="generate">
							<dt>↳ Reasoning <span class="note">(subset of output)</span></dt>
							<dd>{tb.reasoningTokensReal}</dd>
						</div>
					{/if}
					{#if tb.cachedInputTokensReal != null}
						<div class="row sub" data-phase="generate">
							<dt>↳ Cached input <span class="note">(subset of input)</span></dt>
							<dd>{tb.cachedInputTokensReal}</dd>
						</div>
					{/if}
					{#if tb.embedTokensReal != null}
						<div class="row" data-phase="embed"><dt>Embedding</dt><dd>{tb.embedTokensReal}</dd></div>
					{/if}
				</dl>
			</section>

			<section class="token-section">
				<h4 class="section-head est">~ Estimated <span class="note">(chars / 4)</span></h4>
				<dl class="rows">
					{#if tb.systemPromptTokensEst != null}
						<div class="row est-row" data-phase="assemble">
							<dt>System prompt</dt><dd>~{tb.systemPromptTokensEst}</dd>
						</div>
					{/if}
					<div class="row est-row" data-phase="assemble">
						<dt>Context</dt><dd>~{tb.contextTokensEst}</dd>
					</div>
					{#if tb.baseSystemApprox != null}
						<div class="row est-row" data-phase="assemble">
							<dt>Base system <span class="note">(approx)</span></dt><dd>~{tb.baseSystemApprox}</dd>
						</div>
					{/if}
					{#if tb.promptOverheadApprox != null}
						<div class="row est-row" data-phase="generate">
							<dt>Prompt overhead <span class="note">(approx)</span></dt><dd>~{tb.promptOverheadApprox}</dd>
						</div>
					{/if}
				</dl>
			</section>
		</div>
	{/if}

	{#if prompt}
		<section class="prompt-section">
			<button
				type="button"
				class="collapsible-head"
				aria-expanded={promptOpen}
				onclick={() => (promptOpen = !promptOpen)}
			>
				<span class="i-lucide-chevron-right chev" class:open={promptOpen} aria-hidden="true"></span>
				<span class="section-head inline">Assembled prompt</span>
				<span class="token-pill">~{prompt.totalTokens} ctx tokens</span>
			</button>

			{#if promptOpen}
				<div class="prompt-blocks">
					{#if prompt.systemPrompt}
						<div class="prompt-block">
							<span class="block-label">system</span>
							<pre class="prompt-text">{prompt.systemPrompt}</pre>
						</div>
					{:else if prompt.systemPromptHash}
						<div class="prompt-block">
							<span class="block-label">system (redacted)</span>
							<code class="hash">{prompt.systemPromptHash}</code>
						</div>
					{/if}
					<div class="prompt-block">
						<span class="block-label">user</span>
						<pre class="prompt-text">{prompt.userPrompt}</pre>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.tokens-pane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
	}

	.token-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.token-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.section-head {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-fg);
	}

	.section-head.est {
		color: var(--color-muted);
	}

	.section-head.inline {
		text-transform: none;
		letter-spacing: 0;
	}

	.note {
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
		color: var(--color-muted);
		font-size: 10px;
	}

	.rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-3);
		padding: 2px var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: 12px;
	}

	.row dt {
		color: var(--color-fg);
	}

	.row dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		color: var(--color-fg);
	}

	.row.sub dt {
		color: var(--color-muted);
		padding-left: var(--spacing-2);
	}

	.est-row dt,
	.est-row dd {
		color: var(--color-muted);
	}

	:global(.row-highlight) {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		box-shadow: inset 2px 0 0 var(--color-primary);
	}

	.prompt-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
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
		width: 12px;
		height: 12px;
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
		background: var(--surface-1);
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

	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}
</style>
