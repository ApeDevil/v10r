<script lang="ts">
import { page } from '$app/state';
import { ErrorDisplay } from '$lib/components/composites';
import { Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let heading = $state<HTMLHeadingElement | null>(null);

// Move focus to the recovery heading so a stranded reader (e.g. an old
// /connection|/session|/security bookmark, now 404) lands on the way out.
$effect(() => {
	heading?.focus();
});
</script>

<svelte:head>
	<title>{page.status} — {m.showcase_auth_layout_title()}</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
	context="showcase"
>
	<div class="moved">
		<h2 bind:this={heading} tabindex="-1" class="moved-h">
			{m.showcase_auth_error_heading()}
		</h2>
		<p class="moved-p">{m.showcase_auth_error_body()}</p>
		<Button variant="default" size="sm" href={localizeHref('/showcases/auth')}>
			<span class="i-lucide-shield-check mr-2" aria-hidden="true"></span>
			{m.showcase_auth_error_cta()}
		</Button>
	</div>
</ErrorDisplay>

<style>
	.moved {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		text-align: center;
	}
	.moved-h {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}
	.moved-h:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
		border-radius: var(--radius-sm);
	}
	.moved-p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}
</style>
