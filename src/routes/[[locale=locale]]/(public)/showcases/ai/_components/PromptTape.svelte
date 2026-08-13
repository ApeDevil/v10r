<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { PROMPT_BLOCKS } from '$lib/showcase/ai/topology';
import type { AiSurfaceId } from '$lib/types/ai-tools';
import type { PromptOutline } from '$lib/types/turn-trace';

// An ordered band stack (HTML, not SVG) with the cache boundary drawn as a rule.
// Block NAMES and estimated counts only — bodies never reach this page (the
// PromptOutline type physically cannot carry them).
let { surface, prompt = null }: { surface: AiSurfaceId; prompt?: PromptOutline | null } = $props();

const blocks = PROMPT_BLOCKS[surface];
const boundaryIndex = blocks.findIndex((b) => !b.cacheStable);

const BLOCK_TAGS: Record<string, string> = {
	role: surface === 'deskbot' ? 'DESK_SYSTEM_PROMPT' : 'SYSTEM_PROMPT',
	completion: '<completion>',
	planning: '<planning>',
	permissions: '<permissions>',
	workspace: 'workspace sentence',
	'desk-context': '<desk-context>',
	'desk-layout': '<desk-layout>',
	'project-overview': '<project-overview>',
	'current-page': '<current-page>',
	'catalog-map': '<catalog-map>',
};

function tokensFor(id: string): number | undefined {
	return prompt?.blocks.find((b) => b.id === id)?.tokensEst;
}
</script>

<div class="tape">
	{#each blocks as block, i (block.id)}
		{#if i === boundaryIndex}
			<div class="boundary" role="separator" aria-label={m.showcase_ai_prompt_cache_boundary()}>
				<span>{m.showcase_ai_prompt_cache_boundary()}</span>
			</div>
		{/if}
		<div class="band" data-conditional={!!block.conditional}>
			<code class="tag">{BLOCK_TAGS[block.id] ?? block.id}</code>
			{#if block.conditional}
				<code class="predicate">⟨{block.conditional}⟩</code>
			{/if}
			{#if tokensFor(block.id) !== undefined}
				<span class="tokens">~{tokensFor(block.id)} tok</span>
			{/if}
		</div>
	{/each}
	{#if prompt}
		<p class="est">
			<span class="i-lucide-info h-3.5 w-3.5" aria-hidden="true"></span>
			{m.showcase_ai_prompt_est_badge()}{#if prompt.totalTokensEst}&nbsp;· ~{prompt.totalTokensEst} tok{/if}
		</p>
	{/if}
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
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
	}

	/* Conditional bands are dashed with their predicate named — they vanish with it. */
	.band[data-conditional='true'] {
		border-style: dashed;
	}

	.tag {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.predicate {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.tokens {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
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

	.est {
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
