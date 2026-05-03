<script lang="ts">
import { Button } from '$lib/components/primitives/button';
import * as m from '$lib/paraglide/messages';

let dismissed = $state(false);
</script>

{#if !dismissed}
	<aside class="banner" role="status" aria-live="polite">
		<div class="content">
			<span class="i-lucide-languages icon" aria-hidden="true"></span>
			<div class="text">
				<strong class="title">{m.composites_locale_fallback_title()}</strong>
				<p class="body">{m.composites_locale_fallback_body()}</p>
			</div>
		</div>
		<Button variant="ghost" size="sm" onclick={() => { dismissed = true; }}>
			{m.composites_locale_fallback_dismiss()}
		</Button>
	</aside>
{/if}

<style>
	.banner {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		justify-content: space-between;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning) 8%, var(--color-bg));
	}

	.content {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		flex: 1;
		min-width: 0;
	}

	.icon {
		flex-shrink: 0;
		margin-top: var(--spacing-1);
		font-size: var(--text-fluid-base);
		color: var(--color-warning);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.body {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
