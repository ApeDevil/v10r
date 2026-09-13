<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { BLOCK_TAGS } from '$lib/showcases/ai/labels';
import type { AiSurface } from '$lib/types/db-enums';
import type { PromptBlock } from '$lib/types/turn-trace';

// An ordered band stack (HTML, not SVG) over the blocks a turn's trace recorded — the
// prompt as it was sent, in the composer's cache order, with the cache boundary drawn
// where the first per-request block starts. Sizes are the recorded `chars`, never an
// estimate; a block that carries its text opens inline.
let { surface, blocks }: { surface: AiSurface; blocks: readonly PromptBlock[] } = $props();

const boundaryIndex = $derived(blocks.findIndex((b) => !b.stable));
const totalChars = $derived(blocks.reduce((n, b) => n + b.chars, 0));
const fmt = (n: number) => n.toLocaleString();
</script>

<div class="tape">
	{#each blocks as block, i (block.id)}
		{#if i === boundaryIndex}
			<div class="boundary" role="separator" aria-label={m.showcase_ai_prompt_cache_boundary()}>
				<span>{m.showcase_ai_prompt_cache_boundary()}</span>
			</div>
		{/if}
		<details class="band" data-section={block.section}>
			<summary>
				<code class="tag">{BLOCK_TAGS[block.id] ?? block.id}</code>
				{#if block.capability}
					<code class="capability">{block.capability}</code>
				{/if}
				<span class="section">{block.section}</span>
				<span class="chars">{m.showcase_ai_orch_chars({ n: fmt(block.chars) })}</span>
			</summary>
			{#if block.text}
				<pre class="text">{block.text}</pre>
			{:else}
				<p class="withheld">{m.showcase_ai_orch_no_body()}</p>
			{/if}
		</details>
	{/each}
	{#if blocks.length === 0}
		<p class="withheld">{m.showcase_ai_prompt_no_blocks()}</p>
	{/if}
	<p class="total">
		<span class="i-lucide-info h-3.5 w-3.5" aria-hidden="true"></span>
		{m.showcase_ai_prompt_total({ blocks: fmt(blocks.length), chars: fmt(totalChars) })}
	</p>
	{#if surface === 'deskbot'}
		<p class="escape-note">
			<span class="i-lucide-shield-alert h-4 w-4" aria-hidden="true"></span>
			{m.showcase_ai_prompt_escape_note()}
		</p>
	{/if}
</div>

<style>
	.tape {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.band {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
	}

	.band summary {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		padding: var(--spacing-2) var(--spacing-3);
		cursor: pointer;
		list-style: none;
	}

	.band summary::-webkit-details-marker {
		display: none;
	}

	/* The guides and the awareness blocks are per-request: dashed, they vanish with their rule. */
	.band[data-section='guide'],
	.band[data-section='awareness'] {
		border-style: dashed;
	}

	.tag {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.capability,
	.section {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.chars {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}

	.text {
		margin: 0;
		padding: var(--spacing-3);
		border-top: 1px solid var(--color-border);
		max-height: 24rem;
		overflow: auto;
		font-size: var(--text-fluid-xs);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		color: var(--color-fg);
	}

	.withheld {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.boundary {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: var(--spacing-1) 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-warning);
	}

	.boundary::before,
	.boundary::after {
		content: '';
		flex: 1;
		border-top: 2px dashed color-mix(in srgb, var(--color-warning) 60%, transparent);
	}

	.total {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.escape-note {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		margin: var(--spacing-2) 0 0 0;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		line-height: 1.5;
		border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
		border-radius: var(--radius-sm);
	}

	.escape-note span {
		flex-shrink: 0;
		color: var(--color-warning);
		margin-top: 0.1rem;
	}
</style>
