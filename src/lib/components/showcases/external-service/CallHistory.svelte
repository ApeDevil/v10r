<script lang="ts">
import { Body, Cell, Header, HeaderCell, Row, Table } from '#lib/components/primitives/index.ts';
import type { ExternalServiceCopy } from '#lib/showcases/external-service/labels.ts';
import type { PublicServiceCall } from '#lib/showcases/external-service/types.ts';
import OutcomeBadge from './OutcomeBadge.svelte';

interface Props {
	calls: PublicServiceCall[];
	copy: ExternalServiceCopy;
}

let { calls, copy }: Props = $props();

const ms = (value: number | null | undefined) => (value === null || value === undefined ? '—' : String(value));
const time = (iso: string) => iso.slice(11, 19);
</script>

<Table>
	<Header>
		<Row>
			<HeaderCell>{copy.col_time}</HeaderCell>
			<HeaderCell>{copy.col_target}</HeaderCell>
			<HeaderCell>{copy.col_operation}</HeaderCell>
			<HeaderCell>{copy.label_outcome}</HeaderCell>
			<HeaderCell>{copy.col_round_trip_ms}</HeaderCell>
			<HeaderCell>{copy.col_service_ms}</HeaderCell>
			<HeaderCell>{copy.col_client_ms}</HeaderCell>
		</Row>
	</Header>
	<Body>
		{#each calls as call, index (index)}
			<Row>
				<Cell><code>{time(call.measuredAt)}</code></Cell>
				<Cell>{call.target}</Cell>
				<Cell><code>{call.operation}</code></Cell>
				<Cell><OutcomeBadge outcome={call.outcome} {copy} /></Cell>
				<Cell><code>{ms(call.timing?.roundTripMs)}</code></Cell>
				<Cell><code>{ms(call.timing?.serviceMs)}</code></Cell>
				<Cell><code>{ms(call.timing?.clientMs)}</code></Cell>
			</Row>
		{/each}
	</Body>
</Table>
