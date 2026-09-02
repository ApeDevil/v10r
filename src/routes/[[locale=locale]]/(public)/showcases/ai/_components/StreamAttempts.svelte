<script lang="ts">
import { Waterfall, type WaterfallRow } from '$lib/components/viz';
import * as m from '$lib/paraglide/messages';
import { STEP_BUDGETS } from '$lib/showcases/ai/topology';
import type { AiSurface } from '$lib/types/db-enums';

// A turn is a chain of attempts, not one call. Providers stay abstract
// (primary/fallback) — live provider status on a public page is a probe signal.
let { surface }: { surface: AiSurface } = $props();

const rows: WaterfallRow[] = [
	{
		id: 'attempt-1',
		label: m.showcase_ai_stream_attempt({ n: '1', provider: 'primary' }),
		startOffsetMs: 0,
		durationMs: 800,
		status: 'error',
		color: 'var(--chart-4)',
		groupId: 'attempts',
		groupLabel: 'streamText',
	},
	{
		id: 'cooldown',
		label: '429 → markCooldown(60s)',
		startOffsetMs: 800,
		durationMs: 150,
		status: 'done',
		color: 'var(--chart-7)',
		groupId: 'attempts',
		groupLabel: 'streamText',
	},
	{
		id: 'attempt-2',
		label: m.showcase_ai_stream_attempt({ n: '2', provider: 'fallback' }),
		startOffsetMs: 950,
		durationMs: 2400,
		status: 'done',
		color: 'var(--chart-3)',
		groupId: 'attempts',
		groupLabel: 'streamText',
	},
];
</script>

<div class="stream">
	<Waterfall {rows} totalMs={3400} />

	<dl class="stats">
		<div class="stat">
			<dt>{m.showcase_ai_stream_budget_read()}</dt>
			<dd><code>stepCountIs({surface === 'chatbot' ? STEP_BUDGETS.chatbot : STEP_BUDGETS.deskRead})</code></dd>
		</div>
		{#if surface === 'deskbot'}
			<div class="stat">
				<dt>{m.showcase_ai_stream_budget_mutate()}</dt>
				<dd><code>stepCountIs({STEP_BUDGETS.deskMutate})</code></dd>
			</div>
		{/if}
	</dl>

	<p class="leakguard">
		<span class="i-lucide-shield h-4 w-4" aria-hidden="true"></span>
		{m.showcase_ai_stream_leakguard()}
	</p>
</div>

<style>
	.stream {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-4);
		margin: 0;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.stat dt {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat dd {
		margin: 0;
	}

	.stat code {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		background: var(--color-subtle);
		padding: 0.1em 0.45em;
		border-radius: var(--radius-sm);
	}

	.leakguard {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.leakguard span {
		flex-shrink: 0;
		margin-top: 0.1rem;
		color: var(--color-primary);
	}
</style>
