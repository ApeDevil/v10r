<script lang="ts">
import { DiagGrid, DiagRow } from '#lib/components/composites/index.ts';
import type { ExternalServiceCopy } from '#lib/showcases/external-service/labels.ts';
import type { PublicServiceCall } from '#lib/showcases/external-service/types.ts';
import OutcomeBadge from './OutcomeBadge.svelte';

interface Props {
	call: PublicServiceCall;
	copy: ExternalServiceCopy;
}

let { call, copy }: Props = $props();

/** `null` is "not observed" — rendered as a dash, never as 0. */
const ms = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value} ms`);
</script>

<DiagGrid>
	<DiagRow label={copy.label_outcome}>
		<OutcomeBadge outcome={call.outcome} {copy} />
	</DiagRow>
	{#if call.httpStatus !== null}
		<DiagRow label={copy.label_http_status}>
			<code>{call.httpStatus}</code>
		</DiagRow>
	{/if}
	{#if call.message}
		<DiagRow label={copy.label_message}>
			<span class="message">{call.message}</span>
		</DiagRow>
	{/if}
	{#if call.timing}
		<DiagRow label={copy.label_round_trip}>
			<code>{ms(call.timing.roundTripMs)}</code>
		</DiagRow>
		<DiagRow label={copy.label_service_time}>
			<code>{ms(call.timing.serviceMs)}</code>
		</DiagRow>
		<DiagRow label={copy.label_client_time}>
			<code>{ms(call.timing.clientMs)}</code>
		</DiagRow>
		<DiagRow label={copy.label_total}>
			<code>{ms(call.timing.totalMs)} · {`${copy.label_attempts}: ${call.timing.attempts}`}</code>
		</DiagRow>
	{/if}
	{#if call.requestId}
		<DiagRow label={copy.label_request_id}>
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
