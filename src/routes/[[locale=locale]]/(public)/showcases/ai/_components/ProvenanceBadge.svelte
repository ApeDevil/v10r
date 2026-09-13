<script lang="ts">
import * as m from '$lib/paraglide/messages';
import type { TurnProvenanceKind } from '$lib/showcases/ai/inspector';

// Provenance is never dismissible: it qualifies THIS turn, not the architecture — one chip,
// text beside a dot so colour never carries it alone: `authored` says a hand wrote it,
// `recorded` that a real turn was exported, `live` that it is the viewer's own persisted trace.
// A caller that owes the reader the one-sentence explanation passes it as `gloss`.
let { source, recordedAt, gloss }: { source: TurnProvenanceKind; recordedAt?: string; gloss?: string } = $props();

const LABELS = {
	authored: m.showcase_ai_prov_authored,
	recorded: m.showcase_ai_prov_recorded,
	live: m.showcase_ai_prov_live,
} as const;
</script>

<span class="provenance" data-source={source}>
	<span class="badge" role="note">
		<span class="dot" aria-hidden="true"></span>
		{LABELS[source]()}{#if recordedAt}<span class="date"> · {recordedAt}</span>{/if}
	</span>
	{#if gloss}<span class="gloss">{gloss}</span>{/if}
</span>

<style>
	.provenance {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		min-width: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.1rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--color-subtle) 60%, transparent);
		color: var(--color-fg);
		font-weight: 500;
		white-space: nowrap;
	}

	.date {
		color: var(--color-muted);
		font-weight: 400;
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--color-muted);
	}

	.provenance[data-source='live'] .dot {
		background: var(--color-success);
	}

	.provenance[data-source='live'] .badge {
		border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
	}

	.provenance[data-source='authored'] .dot {
		background: var(--color-warning);
	}

	.gloss {
		line-height: 1.5;
	}
</style>
