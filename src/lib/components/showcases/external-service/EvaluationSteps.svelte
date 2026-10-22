<script lang="ts">
import { DiagGrid, DiagRow } from '$lib/components/composites';
import { Badge, Body, Cell, Header, HeaderCell, Row, Table } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { OrderEvaluation } from '$lib/showcases/external-service/types';

interface Props {
	evaluation: OrderEvaluation;
}

let { evaluation }: Props = $props();

const REASONS = {
	not_allowed_in_state: m.showcase_external_service_reason_not_allowed_in_state,
	payment_incomplete: m.showcase_external_service_reason_payment_incomplete,
	exceeds_balance: m.showcase_external_service_reason_exceeds_balance,
} as const;

const cents = (value: number) => (value / 100).toFixed(2);
</script>

<DiagGrid>
	<DiagRow label={m.showcase_external_service_label_verdict()}>
		{#if evaluation.outcome === 'accepted'}
			<Badge variant="success">{m.showcase_external_service_verdict_accepted()}</Badge>
		{:else}
			<Badge variant="warning">{m.showcase_external_service_verdict_refused()}</Badge>
		{/if}
	</DiagRow>
	{#if evaluation.outcome === 'accepted'}
		<DiagRow label={m.showcase_external_service_label_final_state()}>
			<code>{evaluation.finalState}</code>
		</DiagRow>
	{:else}
		<DiagRow label={m.showcase_external_service_label_refusal()}>
			<span class="refusal">
				<code>#{evaluation.refusal.index} {evaluation.refusal.event} @ {evaluation.refusal.state}</code>
				— {REASONS[evaluation.refusal.reason]()}
			</span>
		</DiagRow>
	{/if}
	<DiagRow label={m.showcase_external_service_label_ledger()}>
		<code>{cents(evaluation.paidCents)} / −{cents(evaluation.refundedCents)}</code>
	</DiagRow>
</DiagGrid>

{#if evaluation.steps.length > 0}
	<Table>
		<Header>
			<Row>
				<HeaderCell>#</HeaderCell>
				<HeaderCell>{m.showcase_external_service_col_event()}</HeaderCell>
				<HeaderCell>{m.showcase_external_service_col_transition()}</HeaderCell>
			</Row>
		</Header>
		<Body>
			{#each evaluation.steps as step (step.index)}
				<Row>
					<Cell><code>{step.index}</code></Cell>
					<Cell><code>{step.event}</code></Cell>
					<Cell><code>{step.from} → {step.to}</code></Cell>
				</Row>
			{/each}
		</Body>
	</Table>
{/if}

<style>
	.refusal {
		text-align: right;
	}
</style>
