<script lang="ts">
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { ServiceCallOutcome } from '$lib/showcases/external-service/types';

interface Props {
	outcome: ServiceCallOutcome;
}

let { outcome }: Props = $props();

const LABELS: Record<ServiceCallOutcome, () => string> = {
	ok: m.showcase_external_service_outcome_ok,
	unreachable: m.showcase_external_service_outcome_unreachable,
	timed_out: m.showcase_external_service_outcome_timed_out,
	unauthorized: m.showcase_external_service_outcome_unauthorized,
	invalid_request: m.showcase_external_service_outcome_invalid_request,
	too_large: m.showcase_external_service_outcome_too_large,
	service_error: m.showcase_external_service_outcome_service_error,
	malformed_response: m.showcase_external_service_outcome_malformed_response,
	unconfigured: m.showcase_external_service_outcome_unconfigured,
	misconfigured: m.showcase_external_service_outcome_misconfigured,
};

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

<Badge {variant}>{LABELS[outcome]()}</Badge>
