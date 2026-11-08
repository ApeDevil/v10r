<script lang="ts">
import { Badge } from '#lib/components/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { type DecisionEvidence, EVIDENCE_KIND_LABELS } from '#patterns/architecture-engineering/index.ts';
import { evidenceHref } from './links.ts';

let { evidence }: { evidence: readonly DecisionEvidence[] } = $props();

/** Measured is the only kind that carries recorded numbers; an estimate is flagged loudest. */
function tone(kind: DecisionEvidence['kind']): 'success' | 'default' | 'secondary' | 'warning' {
	if (kind === 'measured') return 'success';
	if (kind === 'live-measurement' || kind === 'reference-implementation') return 'default';
	if (kind === 'estimate') return 'warning';
	return 'secondary';
}
</script>

<ul class="evidence">
	{#each evidence as entry}
		{@const link = evidenceHref(entry.ref)}
		<li>
			<div class="head">
				<Badge variant={tone(entry.kind)}>{EVIDENCE_KIND_LABELS[entry.kind]}</Badge>
				<a
					href={link.external ? link.href : localizeHref(link.href)}
					target={link.external ? '_blank' : undefined}
					rel={link.external ? 'noopener noreferrer' : undefined}>{entry.ref}</a
				>
			</div>
			<p class="claim">{entry.claim}</p>
			{#if entry.conditions}
				<p class="meta"><strong>{m.studio_evidence_conditions()}</strong> {entry.conditions}</p>
			{/if}
			<p class="meta"><strong>{m.studio_evidence_limitations()}</strong> {entry.limitations}</p>
		</li>
	{/each}
</ul>

<style>
	.evidence {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.head a {
		font-family: var(--font-mono);
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		overflow-wrap: anywhere;
	}

	.claim {
		margin: var(--spacing-1) 0 0;
	}

	.meta {
		margin: var(--spacing-1) 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
