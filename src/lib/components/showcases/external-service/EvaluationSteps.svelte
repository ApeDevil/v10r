<script lang="ts">
import { DiagGrid, DiagRow } from '#lib/components/composites/index.ts';
import { Badge, Body, Cell, Header, HeaderCell, Row, Table } from '#lib/components/primitives/index.ts';
import type { ExternalServiceCopy } from '#lib/showcases/external-service/labels.ts';
import type { OrderEvaluation } from '#lib/showcases/external-service/types.ts';

interface Props {
	evaluation: OrderEvaluation;
	copy: ExternalServiceCopy;
}

let { evaluation, copy }: Props = $props();

const cents = (value: number) => (value / 100).toFixed(2);
</script>

<DiagGrid>
	<DiagRow label={copy.label_verdict}>
		{#if evaluation.outcome === 'accepted'}
			<Badge variant="success">{copy.verdict_accepted}</Badge>
		{:else}
			<Badge variant="warning">{copy.verdict_refused}</Badge>
		{/if}
	</DiagRow>
	{#if evaluation.outcome === 'accepted'}
		<DiagRow label={copy.label_final_state}>
			<code>{evaluation.finalState}</code>
		</DiagRow>
	{:else}
		<DiagRow label={copy.label_refusal}>
			<span class="refusal">
				<code>#{evaluation.refusal.index} {evaluation.refusal.event} @ {evaluation.refusal.state}</code>
				— {copy[`reason_${evaluation.refusal.reason}`]}
			</span>
		</DiagRow>
	{/if}
	<DiagRow label={copy.label_ledger}>
		<code>{cents(evaluation.paidCents)} / −{cents(evaluation.refundedCents)}</code>
	</DiagRow>
</DiagGrid>

{#if evaluation.steps.length > 0}
	<Table>
		<Header>
			<Row>
				<HeaderCell>#</HeaderCell>
				<HeaderCell>{copy.col_event}</HeaderCell>
				<HeaderCell>{copy.col_transition}</HeaderCell>
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
