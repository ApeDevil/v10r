<script lang="ts">
import type { LlmwikiTraceState } from './llmwiki';
import type { RawragTraceState } from './rawrag';

interface Props {
	rawrag: RawragTraceState;
	llmwiki: LlmwikiTraceState;
	isLlmwiki: boolean;
	onExpand: () => void;
}

let { rawrag, llmwiki, isLlmwiki, onExpand }: Props = $props();

const steps = $derived(isLlmwiki ? llmwiki.steps : rawrag.steps);
const totalMs = $derived(isLlmwiki ? llmwiki.totalDurationMs : rawrag.totalDurationMs);
const isActive = $derived(isLlmwiki ? llmwiki.isActive : rawrag.isActive);
const summary = $derived(isLlmwiki ? llmwiki.summaryLabel : rawrag.summaryLabel);
const drillCount = $derived(isLlmwiki ? llmwiki.drillCount : 0);

const visibleSteps = $derived(steps.filter((s) => s.status !== 'skipped' && s.status !== 'pending'));
const maxDuration = $derived(Math.max(...visibleSteps.map((s) => s.durationMs ?? 0), 1));

const topChunks = $derived(isLlmwiki ? [] : (rawrag.chunkData?.contextChunks ?? []).slice(0, 2));

function stepColor(id: string): string {
	if (id === 'embed') return 'var(--color-primary)';
	if (id.startsWith('tier-')) return 'var(--color-accent)';
	if (id === 'rank') return 'var(--color-info-fg, var(--color-primary))';
	if (id === 'context' || id === 'llmwiki:context') return 'var(--color-success-fg, var(--color-accent))';
	if (id === 'generate') return 'var(--color-fg)';
	if (id === 'llmwiki:overview') return 'var(--color-muted)';
	if (id === 'llmwiki:search') return 'var(--color-accent)';
	if (id === 'rawrag:drill') return 'var(--color-primary)';
	if (id === 'llmwiki:verify') return 'var(--color-success-fg, var(--color-accent))';
	return 'var(--color-muted)';
}
</script>

<div class="trace-rail" role="region" aria-label="Retrieval trace">
	<div class="rail-left">
		<div class="rail-label">
			{#if isActive}
				<span class="pulse-dot" aria-hidden="true"></span>
				<span class="label-text">Running…</span>
			{:else if totalMs > 0}
				<span class="i-lucide-activity h-3 w-3" aria-hidden="true"></span>
				<span class="label-text">{totalMs}ms</span>
			{:else}
				<span class="i-lucide-activity h-3 w-3" aria-hidden="true"></span>
				<span class="label-text">Idle</span>
			{/if}
		</div>

		{#if visibleSteps.length > 0}
			<div class="latency-bar" aria-label="Step latency breakdown">
				{#each visibleSteps as step (step.id)}
					{@const width = step.durationMs ? (step.durationMs / maxDuration) * 100 : 4}
					<div
						class="bar-segment"
						class:error={step.status === 'error'}
						class:active={step.status === 'active'}
						style:width="{width}%"
						style:background-color={stepColor(step.id)}
						title="{step.label}: {step.durationMs ?? 0}ms"
					>
						<span class="seg-label">{step.label}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty-hint">Ask a question — the retrieval trace will appear here.</p>
		{/if}
	</div>

	<div class="rail-right">
		{#if drillCount > 0}
			<span class="drill-glyph" title="{drillCount} drill-down call{drillCount === 1 ? '' : 's'}">
				<span class="i-lucide-git-fork h-3 w-3" aria-hidden="true"></span>
				{#if drillCount > 1}<sup class="drill-sup">{drillCount}</sup>{/if}
			</span>
		{/if}
		{#if summary}
			<div class="chunk-summary">
				<span class="chunk-count">{summary}</span>
				{#if topChunks.length > 0}
					<span class="top-titles">
						{topChunks.map((c) => c.documentTitle).join(' · ')}
					</span>
				{/if}
			</div>
		{/if}
		<button type="button" class="expand-btn" onclick={onExpand} disabled={totalMs === 0 && !isActive}>
			<span class="i-lucide-chevron-right h-3 w-3" aria-hidden="true"></span>
			See full trace
		</button>
	</div>
</div>

<style>
	.trace-rail {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		min-height: 80px;
		padding: var(--spacing-3) var(--spacing-4);
		border-top: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface-2) 60%, transparent);
	}

	.rail-left {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.rail-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: 11px;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.pulse-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-primary);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.label-text {
		font-weight: 600;
		color: var(--color-fg);
	}

	.latency-bar {
		display: flex;
		height: 18px;
		gap: 1px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.bar-segment {
		min-width: 2px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		transition: filter 150ms;
	}

	.bar-segment:hover {
		filter: brightness(1.15);
	}

	.bar-segment.active {
		animation: bar-pulse 1.2s ease-in-out infinite;
	}

	.bar-segment.error {
		background-color: var(--color-error-fg) !important;
	}

	@keyframes bar-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.seg-label {
		font-size: 9px;
		color: white;
		mix-blend-mode: difference;
		padding: 0 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty-hint {
		font-size: 12px;
		color: var(--color-muted);
		margin: 0;
	}

	.rail-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-shrink: 0;
	}

	.chunk-summary {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-size: 11px;
		color: var(--color-muted);
		max-width: 260px;
	}

	.chunk-count {
		color: var(--color-fg);
		font-weight: 500;
	}

	.top-titles {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.expand-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
		color: var(--color-fg);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.expand-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-1));
		border-color: var(--color-primary);
	}

	.expand-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.drill-glyph {
		display: inline-flex;
		align-items: flex-start;
		color: var(--color-primary);
		font-size: 11px;
		font-weight: 600;
	}

	.drill-sup {
		font-size: 9px;
		margin-left: 1px;
		line-height: 1;
	}

	@media (max-width: 640px) {
		.trace-rail {
			flex-direction: column;
			align-items: stretch;
		}
		.rail-right {
			justify-content: space-between;
		}
		.chunk-summary {
			align-items: flex-start;
		}
	}
</style>
