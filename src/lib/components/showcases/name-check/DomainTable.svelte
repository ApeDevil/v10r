<script lang="ts">
/**
 * One row per generated domain variant. Registration is a fact about the domain, so
 * this stays its own section: an available `.com` says nothing about a trade mark, and
 * a taken one is a signal to investigate, not a verdict.
 */
import { Badge } from '$lib/components/primitives';
import { formatDate } from '$lib/i18n';
import type { NameCheckLabels } from '$lib/name-check/labels';
import type { DomainNameMatch } from '$lib/name-check/report';

interface Props {
	domains: DomainNameMatch[];
	labels: Pick<NameCheckLabels, 'registrations' | 'copy'>;
	locale: string;
}

let { domains, labels, locale }: Props = $props();

const BADGE = {
	registered: 'warning',
	dns_records: 'warning',
	not_registered: 'success',
	unknown: 'muted',
	lookup_unavailable: 'muted',
} as const;
</script>

<div class="scroller">
<table class="domains">
	<thead>
		<tr>
			<th scope="col">{labels.copy.domain_col_domain}</th>
			<th scope="col">{labels.copy.domain_col_status}</th>
			<th scope="col">{labels.copy.domain_col_registrar}</th>
			<th scope="col">{labels.copy.domain_col_since}</th>
		</tr>
	</thead>
	<tbody>
		{#each domains as row (row.domain)}
			<tr>
				<th scope="row">
					{#if row.url}
						<a href={row.url} target="_blank" rel="noopener noreferrer">{row.domain}</a>
					{:else}
						{row.domain}
					{/if}
				</th>
				<td><Badge variant={BADGE[row.registration]}>{labels.registrations[row.registration]}</Badge></td>
				<td class="muted">{row.registrar ?? '—'}</td>
				<td class="muted">{row.registeredAt ? formatDate(new Date(row.registeredAt), locale) : '—'}</td>
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

.domains {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-fluid-sm);
}

.domains th,
.domains td {
	padding: var(--spacing-2);
	text-align: left;
	vertical-align: middle;
	border-bottom: 1px solid var(--color-border);
	font-weight: 400;
}

.domains thead th {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}

.domains tbody th {
	font-family: var(--font-mono);
	font-weight: 500;
}

.domains a {
	color: var(--color-primary);
	text-decoration: underline;
	text-underline-offset: 0.15em;
}

.muted {
	color: var(--color-muted);
}
</style>
