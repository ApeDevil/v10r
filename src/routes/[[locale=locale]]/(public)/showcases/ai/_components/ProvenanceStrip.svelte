<script lang="ts">
import * as m from '$lib/paraglide/messages';

let { source, recordedAt }: { source: 'recorded' | 'live'; recordedAt?: string } = $props();
</script>

<!-- Provenance is never dismissible: it qualifies THIS playback, not the architecture. -->
<p class="strip" role="note" data-source={source}>
	<span class="dot" aria-hidden="true"></span>
	{#if source === 'recorded'}
		{m.showcase_ai_prov_recorded({ date: recordedAt ?? '' })}
	{:else}
		{m.showcase_ai_prov_live()}
	{/if}
</p>

<style>
	.strip {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		background: color-mix(in srgb, var(--color-subtle) 60%, transparent);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--color-muted);
	}

	.strip[data-source='live'] .dot {
		background: var(--color-success);
	}

	.strip[data-source='live'] {
		color: var(--color-fg);
		border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
	}
</style>
