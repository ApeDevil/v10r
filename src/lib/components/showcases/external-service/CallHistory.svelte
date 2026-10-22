<script lang="ts">
import { Body, Cell, Header, HeaderCell, Row, Table } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PublicServiceCall } from '$lib/showcases/external-service/types';
import OutcomeBadge from './OutcomeBadge.svelte';

interface Props {
	calls: PublicServiceCall[];
}

let { calls }: Props = $props();

const ms = (value: number | null | undefined) => (value === null || value === undefined ? '—' : String(value));
const time = (iso: string) => iso.slice(11, 19);
</script>

<Table>
	<Header>
		<Row>
			<HeaderCell>{m.showcase_external_service_col_time()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_col_target()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_col_operation()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_label_outcome()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_col_round_trip_ms()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_col_service_ms()}</HeaderCell>
			<HeaderCell>{m.showcase_external_service_col_adapter_ms()}</HeaderCell>
		</Row>
	</Header>
	<Body>
		{#each calls as call, index (index)}
			<Row>
				<Cell><code>{time(call.measuredAt)}</code></Cell>
				<Cell>{call.target}</Cell>
				<Cell><code>{call.operation}</code></Cell>
				<Cell><OutcomeBadge outcome={call.outcome} /></Cell>
				<Cell><code>{ms(call.timing?.roundTripMs)}</code></Cell>
				<Cell><code>{ms(call.timing?.serviceMs)}</code></Cell>
				<Cell><code>{ms(call.timing?.adapterMs)}</code></Cell>
			</Row>
		{/each}
	</Body>
</Table>
