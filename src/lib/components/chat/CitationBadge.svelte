<script lang="ts">
import type { ChunkVerdict } from '$lib/components/chat/citation-types';

interface Props {
	verdict: ChunkVerdict;
}

let { verdict }: Props = $props();

/**
 * Verdict → trust signal. Icon + word (never color alone) so the meaning is
 * conveyed without relying on color (WCAG 1.4.1). Tones use the app.css
 * semantic tokens — no hardcoded colors.
 */
const META: Record<ChunkVerdict, { icon: string; label: string; cls: string }> = {
	quote: { icon: 'i-lucide-check-circle', label: 'Verbatim', cls: 'v-quote' },
	paraphrase: { icon: 'i-lucide-file-text', label: 'Paraphrased', cls: 'v-paraphrase' },
	drifted: { icon: 'i-lucide-alert-triangle', label: 'Source changed', cls: 'v-drifted' },
	uncited: { icon: 'i-lucide-alert-circle', label: 'Unverified', cls: 'v-uncited' },
};

const meta = $derived(META[verdict]);
</script>

<span class={`citation-badge ${meta.cls}`}>
	<span class={`badge-icon ${meta.icon}`} aria-hidden="true"></span>
	<span>{meta.label}</span>
</span>

<style>
	.citation-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.badge-icon {
		width: 0.75rem;
		height: 0.75rem;
	}

	.v-quote {
		background-color: var(--color-success-bg);
		color: var(--color-success-fg);
	}

	.v-paraphrase {
		background-color: var(--color-info-bg);
		color: var(--color-info-fg);
	}

	.v-drifted {
		background-color: var(--color-warning-bg);
		color: var(--color-warning-fg);
	}

	.v-uncited {
		background-color: color-mix(in srgb, var(--color-muted) 16%, transparent);
		color: var(--color-muted);
	}
</style>
