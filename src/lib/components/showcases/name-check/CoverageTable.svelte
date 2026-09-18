<script lang="ts">
/**
 * Which databases were searched, how far each got, and the official search for every
 * one of them. The manual link is unconditional: a complete row still deserves a way to
 * verify, and an incomplete one is exactly where the reader must go next.
 */
import { Badge, Button } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import type { NameCheckLabels } from '$lib/name-check/labels';
import type { NameCheckCoverage } from '$lib/name-check/report';

interface Props {
	coverage: NameCheckCoverage[];
	/** Server-resolved label maps (`$lib/name-check/labels`). */
	labels: Pick<NameCheckLabels, 'sources' | 'coverageStatuses' | 'copy'>;
	/** App locale for relative times. */
	locale: string;
}

let { coverage, labels, locale }: Props = $props();

const BADGE = {
	complete: 'success',
	manual_only: 'secondary',
	credentials_missing: 'muted',
	quota_exhausted: 'warning',
	timed_out: 'warning',
	unavailable: 'error',
} as const;

/** A text marker beside the colour, so the row reads the same without it. */
const MARK = {
	complete: '✓',
	manual_only: '→',
	credentials_missing: '–',
	quota_exhausted: '⚠',
	timed_out: '⚠',
	unavailable: '⚠',
} as const;
</script>

<div class="scroller">
<table class="coverage">
	<thead>
		<tr>
			<th scope="col">{labels.copy.coverage_col_source}</th>
			<th scope="col">{labels.copy.coverage_col_status}</th>
			<th scope="col" class="num">{labels.copy.coverage_col_matches}</th>
			<th scope="col">{labels.copy.coverage_col_retrieved}</th>
			<th scope="col"><span class="sr-only">{labels.copy.coverage_col_action}</span></th>
		</tr>
	</thead>
	<tbody>
		{#each coverage as row (row.sourceId)}
			<tr>
				<th scope="row">{labels.sources[row.sourceId]}</th>
				<td>
					<Badge variant={BADGE[row.status]}>{MARK[row.status]} {labels.coverageStatuses[row.status]}</Badge>
				</td>
				<td class="num">{row.status === 'complete' ? row.matchCount : '—'}</td>
				<td class="when">
					{#if row.retrievedAt}
						{formatRelative(new Date(row.retrievedAt), locale)}
						{#if row.cached}
							<span class="cached">· {labels.copy.coverage_cached}</span>
						{/if}
					{:else}
						—
					{/if}
				</td>
				<td class="action">
					<Button href={row.manualUrl} target="_blank" rel="noopener noreferrer" variant="outline" size="sm">
						{labels.copy.coverage_open}
					</Button>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
</div>

<style>
/* Wide on purpose; the card must never make the page scroll sideways. */
.scroller {
	overflow-x: auto;
}

.coverage {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-fluid-sm);
}

.coverage th,
.coverage td {
	padding: var(--spacing-2);
	text-align: left;
	vertical-align: middle;
	border-bottom: 1px solid var(--color-border);
	font-weight: 400;
}

.coverage thead th {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}

.coverage tbody th {
	font-weight: 500;
}

.num {
	text-align: right;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.when {
	color: var(--color-muted);
	white-space: nowrap;
}

.cached {
	font-size: var(--text-fluid-xs);
}

.action {
	text-align: right;
	white-space: nowrap;
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
}
</style>
