<script lang="ts">
import type { LlmwikiCitationStatus } from '$lib/types/pipeline';

interface Props {
	status: LlmwikiCitationStatus;
}

let { status }: Props = $props();

const config = $derived.by(() => {
	switch (status) {
		case 'quote':
			return { icon: 'i-lucide-check', label: 'Verbatim', tone: 'primary' as const };
		case 'paraphrase':
			return { icon: 'i-lucide-arrow-left-right', label: 'Paraphrased', tone: 'success' as const };
		case 'drifted':
			return { icon: 'i-lucide-alert-triangle', label: 'Drifted', tone: 'warn' as const };
		case 'uncited':
			return { icon: 'i-lucide-minus', label: 'Not used', tone: 'muted' as const };
		case 'none':
			return { icon: 'i-lucide-circle', label: 'Not verified', tone: 'muted' as const };
	}
});
</script>

<span class="citation-badge" data-tone={config.tone}>
	<span class="{config.icon} h-3 w-3" aria-hidden="true"></span>
	<span>{config.label}</span>
</span>

<style>
	.citation-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 10px;
		font-weight: 500;
		white-space: nowrap;
		background: color-mix(in srgb, currentColor 10%, transparent);
	}

	.citation-badge[data-tone='primary'] {
		color: var(--color-primary);
	}
	.citation-badge[data-tone='success'] {
		color: var(--color-success-fg, var(--color-accent));
	}
	.citation-badge[data-tone='warn'] {
		color: var(--color-warning-fg, #c2860a);
	}
	.citation-badge[data-tone='muted'] {
		color: var(--color-muted);
	}
</style>
