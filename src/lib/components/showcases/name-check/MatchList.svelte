<script lang="ts">
/**
 * Trade mark, company and web findings, one row each: the name as the source spells it,
 * the similarity that surfaced it (score AND basis — the number never travels alone),
 * and the record's own facts. Every row links to the authoritative record when the
 * source has one.
 */
import { Badge } from '$lib/components/primitives';
import type { NameCheckLabels } from '$lib/name-check/labels';
import type { NameMatch } from '$lib/name-check/report';

interface Props {
	matches: NameMatch[];
	labels: Pick<NameCheckLabels, 'sources' | 'bases' | 'categoryRelevance' | 'territoryRelevance' | 'copy'>;
	emptyText: string;
}

let { matches, labels, emptyText }: Props = $props();

function scoreVariant(score: number): 'error' | 'warning' | 'secondary' {
	if (score >= 95) return 'error';
	if (score >= 80) return 'warning';
	return 'secondary';
}
</script>

{#if matches.length === 0}
	<p class="empty">{emptyText}</p>
{:else}
	<ul class="matches">
		{#each matches as match (`${match.sourceId}:${match.externalId ?? match.label}`)}
			<li class="match">
				<div class="head">
					<span class="label">
						{#if match.url}
							<a href={match.url} target="_blank" rel="noopener noreferrer">{match.label}</a>
						{:else}
							{match.label}
						{/if}
					</span>
					<Badge variant={scoreVariant(match.similarity.score)}>
						{labels.copy.similarity_label}: {match.similarity.score}% ·
						{labels.bases[match.similarity.basis]}
					</Badge>
				</div>
				<dl class="facts">
					<dt>{labels.copy.match_source}</dt>
					<dd>{labels.sources[match.sourceId]}</dd>
					{#if match.kind === 'trademark'}
						<dt>{labels.copy.match_status}</dt>
						<dd>{match.status ?? labels.copy.match_status_unknown}</dd>
						{#if match.owner}
							<dt>{labels.copy.match_owner}</dt>
							<dd>{match.owner}</dd>
						{/if}
						{#if match.niceClasses.length > 0}
							<dt>{labels.copy.match_classes}</dt>
							<dd>{match.niceClasses.join(', ')} · {labels.categoryRelevance[match.categoryRelevance]}</dd>
						{/if}
					{:else if match.kind === 'company'}
						<dt>{labels.copy.match_status}</dt>
						<dd>{match.status ?? labels.copy.match_status_unknown}</dd>
					{:else if match.kind === 'web'}
						<dt>{labels.copy.match_host}</dt>
						<dd>{match.host}</dd>
						{#if match.snippet}
							<dt>{labels.copy.match_snippet}</dt>
							<dd class="snippet">{match.snippet}</dd>
						{/if}
					{/if}
					{#if match.jurisdiction}
						<dt>{labels.copy.match_jurisdiction}</dt>
						<dd>{match.jurisdiction} · {labels.territoryRelevance[match.territoryRelevance]}</dd>
					{/if}
				</dl>
			</li>
		{/each}
	</ul>
{/if}

<style>
.empty {
	margin: 0;
	color: var(--color-muted);
	font-size: var(--text-fluid-sm);
}

.matches {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3);
	padding: 0;
	margin: 0;
	list-style: none;
}

.match {
	padding: var(--spacing-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-md);
}

.head {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing-2);
}

.label {
	font-weight: 600;
}

.label a {
	color: var(--color-primary);
	text-decoration: underline;
	text-underline-offset: 0.15em;
}

.facts {
	display: grid;
	grid-template-columns: max-content 1fr;
	column-gap: var(--spacing-3);
	row-gap: var(--spacing-1);
	margin: var(--spacing-2) 0 0;
	font-size: var(--text-fluid-xs);
}

.facts dt {
	color: var(--color-muted);
}

.facts dd {
	margin: 0;
}

.snippet {
	color: var(--color-muted);
}
</style>
