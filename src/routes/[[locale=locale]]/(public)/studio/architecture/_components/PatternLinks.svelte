<script lang="ts">
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { patternHref } from './links.ts';

let { ids, label = m.studio_patterns_label() }: { ids: readonly string[]; label?: string } = $props();
</script>

{#if ids.length > 0}
	<p class="patterns">
		<span class="label">{label}</span>
		{#each ids as id, index}
			<a href={localizeHref(patternHref(id))}>{id}</a>{index < ids.length - 1 ? ', ' : ''}
		{/each}
	</p>
{/if}

<style>
	.patterns {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.label {
		font-weight: 600;
		margin-right: var(--spacing-1);
	}

	a {
		color: var(--color-primary);
		font-family: var(--font-mono);
	}
</style>
