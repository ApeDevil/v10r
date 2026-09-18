<script lang="ts">
/**
 * The report's headline: a descriptive level with the evidence behind it. Colour is
 * doubled by the Alert's icon and the level's words, never carried alone, and the list
 * of reasons is what turns "strong conflict signals" into something a reader can check.
 * Level and reasons arrive as strings — resolved server-side by `$lib/name-check/labels`.
 */
import { Alert } from '$lib/components/composites';
import { Badge } from '$lib/components/primitives';
import type { NameCheckLabels } from '$lib/name-check/labels';
import type { NameConflictSignal } from '$lib/name-check/report';

interface Props {
	signal: NameConflictSignal;
	/** "Findings for “{name}”", resolved by the action. */
	headline: string;
	levelLabel: string;
	reasons: string[];
	copy: NameCheckLabels['copy'];
}

let { signal, headline, levelLabel, reasons, copy }: Props = $props();

const VARIANT = { none: 'success', similar: 'info', potential: 'warning', strong: 'error' } as const;
</script>

<Alert variant={VARIANT[signal.level]} title={levelLabel} description={headline}>
	{#if signal.manualReviewRecommended}
		<p class="review"><Badge variant="warning">{copy.manual_review}</Badge></p>
	{/if}
	{#if reasons.length > 0}
		<p class="why">{copy.why}</p>
		<ul class="reasons">
			{#each reasons as reason, index (`${index}-${reason}`)}
				<li>{reason}</li>
			{/each}
		</ul>
	{/if}
</Alert>

<style>
.review {
	margin: 0 0 var(--spacing-2);
}

.why {
	margin: 0;
	font-weight: 600;
	font-size: var(--text-fluid-sm);
}

.reasons {
	margin: var(--spacing-1) 0 0;
	padding-left: var(--spacing-4);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-1);
	font-size: var(--text-fluid-sm);
}

.reasons li {
	list-style: disc;
}
</style>
