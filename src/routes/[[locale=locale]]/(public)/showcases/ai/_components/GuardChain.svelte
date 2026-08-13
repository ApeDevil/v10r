<script lang="ts">
import { GUARD_LABELS } from '$lib/showcase/ai/labels';
import { GUARD_STAGES } from '$lib/showcase/ai/topology';
import type { GuardStageState } from '$lib/types/turn-trace';

// Byte-identical on both pages, deliberately — the guard is shared mechanism.
// A chain with side-exits, not a flowchart with diamonds: nothing re-joins.
let { guard = null }: { guard?: readonly GuardStageState[] | null } = $props();

function stateOf(id: string): GuardStageState | undefined {
	return guard?.find((g) => g.id === id);
}
</script>

<ol class="chain">
	{#each GUARD_STAGES as stage (stage.id)}
		{@const state = stateOf(stage.id)}
		<li class="gate" data-status={state?.status ?? 'rest'}>
			<div class="gate-main">
				<span class="gate-name">{GUARD_LABELS[stage.id].name()}</span>
				<code class="gate-check">{stage.check}</code>
				<p class="gate-gloss">{GUARD_LABELS[stage.id].gloss()}</p>
			</div>
			<div class="gate-exit" data-fired={state?.status === 'error'}>
				<span class="exit-arrow" aria-hidden="true">→</span>
				<code>{stage.httpStatus} {stage.code}</code>
			</div>
		</li>
	{/each}
</ol>

<style>
	.chain {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.gate {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0 var(--spacing-2) var(--spacing-4);
	}

	.gate::before {
		content: '';
		position: absolute;
		left: 0.4rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-border);
	}

	.gate:first-child::before {
		top: 50%;
	}

	.gate:last-child::before {
		bottom: 50%;
	}

	.gate-main {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
	}

	.gate[data-status='error'] .gate-main {
		border-color: color-mix(in srgb, var(--color-error) 50%, var(--color-border));
	}

	.gate[data-status='done'] .gate-main {
		border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
	}

	.gate-name {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		margin-right: var(--spacing-2);
	}

	.gate-check {
		font-size: var(--text-fluid-xs);
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
	}

	.gate-gloss {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	/* One lateral failure edge per gate — a terminating stub, drawn even at rest. */
	.gate-exit {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		white-space: nowrap;
	}

	.gate-exit code {
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.1em 0.4em;
	}

	.gate-exit[data-fired='true'] {
		color: var(--color-error);
	}

	.gate-exit[data-fired='true'] code {
		border-color: var(--color-error);
		border-style: solid;
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
	}

	@media (max-width: 480px) {
		.gate {
			flex-direction: column;
			gap: var(--spacing-1);
		}

		.gate-exit {
			margin-left: var(--spacing-3);
		}
	}
</style>
