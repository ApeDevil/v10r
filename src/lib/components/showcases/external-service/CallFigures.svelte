<script lang="ts">
import { DiagGrid, DiagRow } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import type { PublicServiceCall } from '$lib/showcases/external-service/types';
import OutcomeBadge from './OutcomeBadge.svelte';

interface Props {
	call: PublicServiceCall;
}

let { call }: Props = $props();

/** `null` is "not observed" — rendered as a dash, never as 0. */
const ms = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value} ms`);
</script>

<DiagGrid>
	<DiagRow label={m.showcase_external_service_label_outcome()}>
		<OutcomeBadge outcome={call.outcome} />
	</DiagRow>
	{#if call.httpStatus !== null}
		<DiagRow label={m.showcase_external_service_label_http_status()}>
			<code>{call.httpStatus}</code>
		</DiagRow>
	{/if}
	{#if call.message}
		<DiagRow label={m.showcase_external_service_label_message()}>
			<span class="message">{call.message}</span>
		</DiagRow>
	{/if}
	{#if call.timing}
		<DiagRow label={m.showcase_external_service_label_round_trip()}>
			<code>{ms(call.timing.roundTripMs)}</code>
		</DiagRow>
		<DiagRow label={m.showcase_external_service_label_service_time()}>
			<code>{ms(call.timing.serviceMs)}</code>
		</DiagRow>
		<DiagRow label={m.showcase_external_service_label_adapter_time()}>
			<code>{ms(call.timing.adapterMs)}</code>
		</DiagRow>
		<DiagRow label={m.showcase_external_service_label_total()}>
			<code>{ms(call.timing.totalMs)} · {m.showcase_external_service_label_attempts({ count: call.timing.attempts })}</code>
		</DiagRow>
	{/if}
	{#if call.requestId}
		<DiagRow label={m.showcase_external_service_label_request_id()}>
			<code class="request-id">{call.requestId}</code>
		</DiagRow>
	{/if}
</DiagGrid>

<style>
	.message {
		text-align: right;
		max-width: 32rem;
	}

	.request-id {
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}
</style>
