<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { PROPOSAL_STATES, PROPOSAL_TRANSITIONS, type ProposalState } from '$lib/showcases/ai/topology';
import type { ProposalRunState } from '$lib/types/turn-trace';

// A genuine state machine, mirrored from the pg enum + the approve route and pinned
// by drift tests. Failure paths are the point: TTL in SQL, no rollback, frozen scopes.
let { proposal = null }: { proposal?: ProposalRunState | null } = $props();

function isCurrent(state: ProposalState): boolean {
	return proposal?.card.status === state;
}

function transitionsFrom(state: ProposalState) {
	return PROPOSAL_TRANSITIONS.filter(([from]) => from === state);
}

const TERMINAL: ReadonlySet<ProposalState> = new Set(['rejected', 'expired', 'executed', 'failed']);
</script>

<div class="lifecycle">
	<ol class="states">
		{#each PROPOSAL_STATES as state (state)}
			<li class="state" data-current={isCurrent(state)} data-terminal={TERMINAL.has(state)}>
				<code class="state-name">{state}</code>
				{#if transitionsFrom(state).length > 0}
					<ul class="edges">
						{#each transitionsFrom(state) as [, to, trigger] (to)}
							<li class="edge">
								<span class="edge-arrow" aria-hidden="true">→</span>
								<code class="edge-to">{to}</code>
								<code class="edge-trigger">{trigger}</code>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>

	<ul class="annotations">
		<li>{m.showcase_ai_approval_ttl()}</li>
		<li>{m.showcase_ai_approval_frozen()}</li>
		<li>{m.showcase_ai_approval_norollback()}</li>
	</ul>
</div>

<style>
	.lifecycle {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.states {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.state {
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.state[data-terminal='true'] {
		border-style: dashed;
	}

	.state[data-current='true'] {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	.state-name {
		font-size: var(--text-fluid-sm);
		font-weight: 700;
		color: var(--color-fg);
	}

	.edges {
		list-style: none;
		margin: var(--spacing-1) 0 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.edge {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		flex-wrap: wrap;
	}

	.edge-arrow {
		color: var(--color-muted);
	}

	.edge-to {
		font-weight: 600;
		color: var(--color-fg);
	}

	.edge-trigger {
		color: var(--color-muted);
		word-break: break-all;
	}

	.annotations {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.annotations li {
		display: flex;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
		padding-left: var(--spacing-3);
		border-left: 2px solid color-mix(in srgb, var(--color-warning) 50%, var(--color-border));
	}
</style>
