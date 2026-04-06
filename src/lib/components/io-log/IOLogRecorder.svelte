<!--
  Headless component — no visible template.
  Mounted at the desk level so it's always active (even when the I/O Log panel is closed).
  Subscribes to AI bus events and records them to the I/O log store.
-->
<script lang="ts">
	import { deduped, getDeskBus } from '$lib/components/composites/dock';
	import { appendIOLog } from '$lib/components/composites/dock/desk-io-log.svelte';

	const bus = getDeskBus();

	$effect(() => {
		const unsub1 = bus.subscribe(
			'ai:toolCall',
			deduped((payload) => {
				appendIOLog({
					turnId: payload.turnId,
					kind: 'tool-call',
					toolName: payload.toolName,
					toolCallId: payload.toolCallId,
					args: payload.args,
				});
			}),
		);

		const unsub2 = bus.subscribe(
			'ai:toolResult',
			deduped((payload) => {
				appendIOLog({
					turnId: payload.turnId,
					kind: 'tool-result',
					toolName: payload.toolName,
					toolCallId: payload.toolCallId,
					result: payload.result,
				});
			}),
		);

		return () => {
			unsub1();
			unsub2();
		};
	});
</script>
