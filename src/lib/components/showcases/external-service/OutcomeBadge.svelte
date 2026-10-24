<script lang="ts">
import { Badge } from '#lib/components/primitives/index.ts';
import type { ExternalServiceCopy } from '#lib/showcases/external-service/labels.ts';
import type { ServiceCallOutcome } from '#lib/showcases/external-service/types.ts';

interface Props {
	outcome: ServiceCallOutcome;
	copy: ExternalServiceCopy;
}

let { outcome, copy }: Props = $props();

/**
 * Green only for an answer that matched the contract. Not-configured is muted, not red:
 * a target this deploy does not have is a fact, not a fault.
 */
const variant = $derived(
	outcome === 'ok'
		? 'success'
		: outcome === 'unconfigured'
			? 'muted'
			: outcome === 'timed_out' || outcome === 'misconfigured'
				? 'warning'
				: 'error',
);
</script>

<Badge {variant}>{copy[`outcome_${outcome}`]}</Badge>
