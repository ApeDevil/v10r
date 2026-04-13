<script lang="ts">
/**
 * PlanCard — inline approval card for multi-step destructive batches.
 *
 * Rendered from `message.metadata.harness.proposal` in the chat stream.
 * Not a modal — no focus trap while the stream is still streaming. When
 * the stream closes (the parent signals via `streamReady`), focus shifts
 * to the primary action and an `aria-live` region announces the card.
 *
 * See `docs/blueprint/ai/harness-lens.md` for the harness lens framing
 * and `policy/governor.ts` → `shouldRequirePlan` for the predicate that
 * decides when this card appears.
 */
import { cn } from '$lib/utils/cn';
import type { ProposalMetadata } from './harness-types';

interface Props {
	proposal: ProposalMetadata;
	/** True once the stream has closed — safe to shift focus to the primary action. */
	streamReady: boolean;
	/** True while an approve or reject request is in flight — disables buttons. */
	busy: boolean;
	onapprove: () => void;
	onreject: () => void;
}

let { proposal, streamReady, busy, onapprove, onreject }: Props = $props();

let runButton: HTMLButtonElement | undefined = $state();

$effect(() => {
	// Only shift focus once the stream has closed. Doing it mid-stream
	// would hijack the user's reading of pipeline events.
	if (streamReady && runButton && proposal.status === 'pending') {
		runButton.focus();
	}
});

const destructiveCount = $derived(proposal.steps.filter((s) => s.risk === 'destructive').length);
const terminalStatus = $derived(proposal.status !== 'pending' ? proposal.status : null);
</script>

<section
	class="plan-card"
	class:plan-card-busy={busy}
	role="region"
	aria-label="Proposed action plan, requires your confirmation"
>
	<header class="plan-card-header">
		<span class="i-lucide-list-checks plan-card-icon" aria-hidden="true"></span>
		<h3 class="plan-card-title">Proposed plan</h3>
		{#if destructiveCount > 0}
			<span class="plan-card-badge">Permanent: {destructiveCount}</span>
		{/if}
	</header>

	<p class="plan-card-goal">{proposal.goal}</p>

	<ol class="plan-card-steps">
		{#each proposal.steps as step, i (i)}
			<li class={cn('plan-card-step', step.risk === 'destructive' && 'plan-card-step-destructive')}>
				<span class="plan-card-step-num">{i + 1}</span>
				<div class="plan-card-step-body">
					<span class="plan-card-step-action">{step.action}</span>
					<span class="plan-card-step-tool">{step.tool}</span>
					<span class="plan-card-step-rationale">{step.rationale}</span>
					{#if step.risk === 'destructive'}
						<span class="plan-card-step-permanent">Permanent</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	{#if proposal.rollback}
		<p class="plan-card-rollback"><strong>Undo:</strong> {proposal.rollback}</p>
	{/if}

	{#if terminalStatus}
		<div class="plan-card-status plan-card-status-{terminalStatus}" aria-live="polite">
			{terminalStatus === 'executed' ? 'Plan executed.' : `Plan ${terminalStatus}.`}
		</div>
	{:else}
		<div class="plan-card-actions">
			<button
				type="button"
				class="plan-card-btn plan-card-btn-reject"
				disabled={busy}
				onclick={onreject}
			>
				Cancel
			</button>
			<button
				type="button"
				class="plan-card-btn plan-card-btn-approve"
				disabled={busy}
				bind:this={runButton}
				onclick={onapprove}
			>
				{destructiveCount > 0 ? 'Run (includes permanent changes)' : 'Run'}
			</button>
		</div>
	{/if}
</section>

<style>
	.plan-card {
		margin: 0.5rem 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-border);
		background-color: color-mix(in srgb, var(--color-muted) 5%, transparent);
	}
	.plan-card-busy {
		opacity: 0.6;
		pointer-events: none;
	}
	.plan-card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.plan-card-icon {
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
	}
	.plan-card-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-fg);
		margin: 0;
	}
	.plan-card-badge {
		margin-left: auto;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.7rem;
		font-weight: 600;
		background-color: color-mix(in srgb, var(--color-error-fg) 15%, transparent);
		color: var(--color-error-fg);
	}
	.plan-card-goal {
		font-size: 0.85rem;
		color: var(--color-fg);
		margin: 0 0 0.5rem;
	}
	.plan-card-steps {
		list-style: none;
		padding: 0;
		margin: 0 0 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.plan-card-step {
		display: flex;
		gap: 0.5rem;
		padding: 0.375rem;
		border-radius: 0.25rem;
		border-left: 3px solid transparent;
	}
	.plan-card-step-destructive {
		border-left-color: var(--color-error-fg);
		background-color: color-mix(in srgb, var(--color-error-fg) 5%, transparent);
	}
	.plan-card-step-num {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-muted);
		min-width: 1rem;
	}
	.plan-card-step-body {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
	}
	.plan-card-step-action {
		font-size: 0.8rem;
		color: var(--color-fg);
	}
	.plan-card-step-tool {
		font-size: 0.7rem;
		font-family: var(--font-mono, monospace);
		color: var(--color-muted);
	}
	.plan-card-step-rationale {
		font-size: 0.7rem;
		color: var(--color-muted);
	}
	.plan-card-step-permanent {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--color-error-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.plan-card-rollback {
		font-size: 0.7rem;
		color: var(--color-muted);
		margin: 0 0 0.5rem;
	}
	.plan-card-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
	.plan-card-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		border: 1px solid var(--color-border);
		cursor: pointer;
	}
	.plan-card-btn-reject {
		background-color: transparent;
		color: var(--color-muted);
	}
	.plan-card-btn-reject:hover:not(:disabled) {
		color: var(--color-fg);
	}
	.plan-card-btn-approve {
		background-color: var(--color-primary);
		color: var(--color-primary-fg, white);
		border-color: var(--color-primary);
	}
	.plan-card-btn-approve:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.plan-card-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.plan-card-status {
		padding: 0.375rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		text-align: center;
	}
	.plan-card-status-executed {
		background-color: color-mix(in srgb, var(--color-success-fg, var(--color-primary)) 10%, transparent);
		color: var(--color-fg);
	}
	.plan-card-status-rejected,
	.plan-card-status-failed,
	.plan-card-status-expired {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
		color: var(--color-muted);
	}
</style>
