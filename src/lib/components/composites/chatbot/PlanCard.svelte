<script lang="ts">
/**
 * PlanCard — inline approval card for a proposed desk mutation plan.
 *
 * Rendered from `message.metadata.harness.proposal` in the chat stream, which is always
 * `pending` on the wire. What happened since is the `run` the desk-bot session keeps per
 * proposal (`approving` → the server's status, or `unknown` until reconciled) and the
 * per-step receipts it received: the card renders those deterministically — done, failed,
 * changed since review, not run — no model has to narrate them.
 *
 * Not a modal — no focus trap while the stream is still streaming. When the stream
 * closes (the parent signals via `streamReady`), focus shifts to the primary action and
 * an `aria-live` region announces the card. Approve and Cancel are disabled while the
 * turn streams or any approval is in flight (`busy`): a plan may only be decided once it
 * is complete and nothing else is changing the desk.
 *
 * Risk and recovery wording come from the tool the step names (server-derived), never
 * from model prose. See `docs/blueprint/ai/harness-lens.md`.
 */
import * as m from '$lib/paraglide/messages';
import type { ProposalRun, ProposalStepReceipt, ProposalStepRecovery } from '$lib/types/ai-proposal';
import { cn } from '$lib/utils/cn';
import type { ProposalMetadata } from './harness-types';

interface Props {
	proposal: ProposalMetadata;
	/** The client-side lifecycle of this proposal; absent = still pending on the card. */
	run?: ProposalRun;
	/** True once the stream has closed — safe to shift focus to the primary action. */
	streamReady: boolean;
	/** True while the turn streams or an approval is in flight — disables both actions. */
	busy: boolean;
	onapprove: () => void;
	onreject: () => void;
}

let { proposal, run, streamReady, busy, onapprove, onreject }: Props = $props();

let runButton: HTMLButtonElement | undefined = $state();

const phase = $derived(run?.phase ?? proposal.status);
const decided = $derived(phase !== 'pending');

$effect(() => {
	// Only shift focus once the stream has closed. Doing it mid-stream
	// would hijack the user's reading of pipeline events.
	if (streamReady && runButton && !decided) {
		runButton.focus();
	}
});

const destructiveCount = $derived(proposal.steps.filter((s) => s.risk === 'destructive').length);

const RECOVERY_COPY: Record<ProposalStepRecovery, () => string> = {
	revision: m.ai_plan_recovery_revision,
	soft_delete: m.ai_plan_recovery_soft_delete,
	rename_back: m.ai_plan_recovery_rename_back,
	none: m.ai_plan_recovery_none,
};

function receiptFor(index: number): ProposalStepReceipt | undefined {
	return run?.steps.find((s) => s.stepIndex === index);
}

/** The per-step verdict once the run has settled; nothing while it is still pending. */
function stepVerdict(index: number): { text: string; kind: 'ok' | 'failed' | 'conflict' | 'skipped' } | null {
	if (
		!run ||
		run.phase === 'pending' ||
		run.phase === 'approving' ||
		run.phase === 'rejected' ||
		run.phase === 'expired'
	)
		return null;
	const receipt = receiptFor(index);
	if (!receipt) return run.phase === 'unknown' ? null : { text: m.ai_plan_step_not_run(), kind: 'skipped' };
	if (receipt.kind === 'ok') {
		const version = receipt.output?.version;
		return {
			text: typeof version === 'number' ? m.ai_plan_step_done_version({ version }) : m.ai_plan_step_done(),
			kind: 'ok',
		};
	}
	return receipt.kind === 'conflict'
		? { text: m.ai_plan_step_conflict(), kind: 'conflict' }
		: { text: `${m.ai_plan_step_failed()}: ${receipt.errorMessage ?? ''}`.trim(), kind: 'failed' };
}

const statusCopy = $derived.by(() => {
	switch (phase) {
		case 'approving':
			return m.ai_plan_status_approving();
		case 'approved':
			return m.ai_plan_status_approved();
		case 'executing':
			return m.ai_plan_status_executing();
		case 'executed':
			return m.ai_plan_status_executed();
		case 'failed':
			if (run?.failureMessage === 'conflict') return m.ai_plan_status_conflict();
			if (run?.failureMessage === 'interrupted') return m.ai_plan_status_interrupted();
			return m.ai_plan_status_failed({ reason: run?.failureMessage ?? '' });
		case 'rejected':
			return m.ai_plan_status_rejected();
		case 'expired':
			return m.ai_plan_status_expired();
		case 'unknown':
			return m.ai_plan_status_unknown();
		default:
			return '';
	}
});
</script>

<section
	class="plan-card"
	class:plan-card-busy={busy && !decided}
	role="region"
	aria-label={m.ai_plan_aria()}
>
	<header class="plan-card-header">
		<span class="i-lucide-list-checks plan-card-icon" aria-hidden="true"></span>
		<h3 class="plan-card-title">{m.ai_plan_title()}</h3>
		{#if destructiveCount > 0}
			<span class="plan-card-badge">{m.ai_plan_destructive_badge({ count: destructiveCount })}</span>
		{/if}
	</header>

	<p class="plan-card-goal">{proposal.goal}</p>

	<ol class="plan-card-steps">
		{#each proposal.steps as step, i (i)}
			{@const verdict = stepVerdict(i)}
			<li
				class={cn(
					'plan-card-step',
					step.risk === 'destructive' && 'plan-card-step-destructive',
					verdict && `plan-card-step-${verdict.kind}`,
				)}
			>
				<span class="plan-card-step-num">{i + 1}</span>
				<div class="plan-card-step-body">
					<span class="plan-card-step-action">{step.action}</span>
					{#if step.target}
						<span class="plan-card-step-target">
							{step.target.version === null
								? step.target.name
								: m.ai_plan_target_version({ name: step.target.name, version: step.target.version })}
						</span>
					{/if}
					<span class="plan-card-step-tool">{step.tool}</span>
					{#if step.rationale}
						<span class="plan-card-step-rationale">{step.rationale}</span>
					{/if}
					<span class="plan-card-step-recovery">{RECOVERY_COPY[step.recovery ?? 'none']()}</span>
					{#if verdict}
						<span class="plan-card-step-verdict">{verdict.text}</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	{#if decided}
		<div class="plan-card-status plan-card-status-{phase}" aria-live="polite">
			{statusCopy}
		</div>
	{:else}
		<div class="plan-card-actions">
			<button
				type="button"
				class="plan-card-btn plan-card-btn-reject"
				disabled={busy}
				onclick={onreject}
			>
				{m.ai_plan_cancel()}
			</button>
			<button
				type="button"
				class="plan-card-btn plan-card-btn-approve"
				disabled={busy}
				bind:this={runButton}
				onclick={onapprove}
			>
				{destructiveCount > 0 ? m.ai_plan_run_destructive() : m.ai_plan_run()}
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
	.plan-card-step-target {
		font-size: 0.75rem;
		color: var(--color-fg);
		opacity: 0.8;
	}
	.plan-card-step-recovery {
		font-size: 0.7rem;
		color: var(--color-muted);
	}
	.plan-card-step-verdict {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-fg);
	}
	.plan-card-step-ok .plan-card-step-verdict {
		color: var(--color-success-fg, var(--color-primary));
	}
	.plan-card-step-failed .plan-card-step-verdict,
	.plan-card-step-conflict .plan-card-step-verdict {
		color: var(--color-error-fg);
	}
	.plan-card-step-skipped {
		opacity: 0.6;
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
	.plan-card-status-expired,
	.plan-card-status-approving,
	.plan-card-status-approved,
	.plan-card-status-executing,
	.plan-card-status-unknown {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
		color: var(--color-muted);
	}
	.plan-card-status-failed {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		color: var(--color-fg);
	}

	/* Narrow widths: full-width stacked actions, primary on top, 44px targets. */
	@media (max-width: 420px) {
		.plan-card-actions {
			flex-direction: column-reverse;
		}

		.plan-card-btn {
			width: 100%;
			min-height: 44px;
		}
	}
</style>
