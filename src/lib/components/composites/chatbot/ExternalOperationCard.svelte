<script lang="ts">
/**
 * ExternalOperationCard — the disclosure of one proposed external operation, and its receipt.
 *
 * Rendered inside `PlanCard` when the proposal approves an external call. It states everything
 * the one-time approval authorizes, from the server's disclosure (never model prose), each as
 * its own row: the peer, the origin the request goes to, the operation, the exact fields and
 * size, the operator credential reference the peer sees, whether data on the peer may change,
 * the operator's reversibility, and that the grant is for this call only. Below the rows, two
 * views of the arguments: the compact preview (values shortened, readable at a glance) and the
 * complete outgoing arguments — every byte sent, bound to the approval by its digest, plus what
 * the protocol adds beside them (A2A metadata).
 *
 * When the arguments quote content the assistant read this turn, approving alone is not enough:
 * the user ticks a separate authorization (`authorizeQuotedContent`), which the approve door
 * requires. Once the operation settled, the receipt says what happened in the strength the
 * server claims it — a reported success is the peer's claim, an unknown outcome is never re-sent
 * — and the peer's answer is shown as untrusted text.
 */
import { Checkbox } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { ExternalOperationCard, ExternalOperationReceiptView } from '#lib/types/ai-proposal.ts';

interface Props {
	card: ExternalOperationCard;
	receipt?: ExternalOperationReceiptView;
	/** Bound: the separate authorization a `quotes_read_content` disclosure needs. */
	authorizeQuotedContent?: boolean;
	/** True once the proposal was decided; the authorization can no longer change. */
	decided: boolean;
}

let { card, receipt, authorizeQuotedContent = $bindable(false), decided }: Props = $props();

const REVERSIBILITY: Record<ExternalOperationCard['reversibility'], () => string> = {
	reversible: () => m.ai_external_reversibility_reversible(),
	compensatable: () => m.ai_external_reversibility_compensatable(),
	irreversible: () => m.ai_external_reversibility_irreversible(),
	unknown: () => m.ai_external_reversibility_unknown(),
};

const outcomeCopy = $derived.by(() => {
	switch (receipt?.outcome) {
		case 'succeeded':
			return m.ai_external_outcome_succeeded();
		case 'failed':
			return m.ai_external_outcome_failed({ reason: receipt.reason ?? '' });
		case 'unknown':
			return m.ai_external_outcome_unknown();
		case 'refused':
			return m.ai_external_outcome_refused({ reason: receipt.reason ?? '' });
		default:
			return receipt && (receipt.status === 'claimed' || receipt.status === 'dispatched')
				? m.ai_external_in_flight()
				: '';
	}
});
</script>

<div class="external-op" data-testid="external-operation-card">
	<dl class="external-op-facts">
		<dt>{m.ai_external_peer_label()}</dt>
		<dd>{card.peerLabel}</dd>
		<dt>{m.ai_external_destination_label()}</dt>
		<dd class="external-op-mono" data-testid="external-operation-destination">{card.destination}</dd>
		<dt>{m.ai_external_operation_label()}</dt>
		<dd class="external-op-mono">{card.operation}</dd>
		<dt>{m.ai_external_sends_label()}</dt>
		<dd>
			{card.fields.length > 0
				? m.ai_external_sends({ fields: card.fields.join(', '), bytes: String(card.bytes) })
				: m.ai_external_sends_nothing()}
		</dd>
		<dt>{m.ai_external_credential_label()}</dt>
		<dd>
			{#if card.credential.kind === 'operator_secret'}
				{m.ai_external_credential_secret()} <span class="external-op-mono">{card.credential.ref}</span>
			{:else}
				{m.ai_external_credential_none()}
			{/if}
		</dd>
		<dt>{m.ai_external_effect_label()}</dt>
		<dd class:external-op-mutates={card.mutates}>
			{card.mutates ? m.ai_external_mutates() : m.ai_external_read_only()}
		</dd>
		<dt>{m.ai_external_reversibility_label()}</dt>
		<dd>{REVERSIBILITY[card.reversibility]()}</dd>
		<dt>{m.ai_external_grant_label()}</dt>
		<dd>{m.ai_external_grant_once()}</dd>
	</dl>

	<details class="external-op-preview" open={card.bytes <= 200}>
		<summary>{m.ai_external_preview_label()}</summary>
		<pre class="external-op-mono">{card.preview}</pre>
	</details>

	<details class="external-op-outgoing" data-testid="external-operation-outgoing">
		<summary>{m.ai_external_outgoing_label({ bytes: String(card.outgoing.bytes) })}</summary>
		<p class="external-op-note">{m.ai_external_outgoing_note()}</p>
		<pre class="external-op-mono external-op-document" tabindex="0">{card.outgoing.document}</pre>
		{#if card.outgoing.envelope.length > 0}
			<p class="external-op-note">{m.ai_external_outgoing_envelope()}</p>
			<dl class="external-op-facts">
				{#each card.outgoing.envelope as entry (entry.field)}
					<dt class="external-op-mono">{entry.field}</dt>
					<dd class="external-op-mono">{entry.value}</dd>
				{/each}
			</dl>
		{/if}
		<p class="external-op-note">
			{m.ai_external_outgoing_digest()}
			<span class="external-op-mono external-op-digest">{card.outgoing.digest}</span>
		</p>
	</details>

	{#if card.contentClass === 'quotes_read_content'}
		<div class="external-op-quoted" role="note">
			<p>{m.ai_external_quoted_warning({ sources: card.quotedFrom.join(', ') })}</p>
			<Checkbox
				bind:checked={authorizeQuotedContent}
				disabled={decided}
				label={m.ai_external_quoted_authorize()}
			/>
		</div>
	{/if}

	{#if outcomeCopy}
		<p class="external-op-outcome external-op-outcome-{receipt?.outcome ?? 'pending'}" aria-live="polite">
			{outcomeCopy}
		</p>
	{/if}
	{#if receipt?.result}
		<details class="external-op-result">
			<summary>{m.ai_external_result_label()}</summary>
			<pre class="external-op-mono">{receipt.result}</pre>
		</details>
	{/if}
</div>

<style>
	.external-op {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
		color: var(--color-fg);
	}
	.external-op-facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.125rem 0.5rem;
		margin: 0;
	}
	.external-op-facts dt {
		color: var(--color-muted);
	}
	.external-op-facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.external-op-mono {
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
	}
	.external-op-mutates {
		color: var(--color-error-fg);
		font-weight: 600;
	}
	.external-op-preview pre,
	.external-op-outgoing pre,
	.external-op-result pre {
		margin: 0.25rem 0 0;
		padding: 0.375rem;
		border-radius: 0.25rem;
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-height: 12rem;
		overflow: auto;
	}
	.external-op-outgoing .external-op-document {
		max-height: 24rem;
		white-space: pre;
		overflow-wrap: normal;
	}
	.external-op-note {
		margin: 0.25rem 0 0;
		color: var(--color-muted);
		font-size: 0.75rem;
	}
	.external-op-digest {
		overflow-wrap: anywhere;
	}
	.external-op-quoted {
		padding: 0.375rem;
		border-radius: 0.25rem;
		border-left: 3px solid var(--color-error-fg);
		background-color: color-mix(in srgb, var(--color-error-fg) 5%, transparent);
	}
	.external-op-quoted p {
		margin: 0 0 0.25rem;
	}
	.external-op-outcome {
		margin: 0;
		font-weight: 600;
	}
	.external-op-outcome-failed,
	.external-op-outcome-unknown,
	.external-op-outcome-refused {
		color: var(--color-error-fg);
	}
</style>
