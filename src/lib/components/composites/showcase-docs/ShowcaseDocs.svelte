<script lang="ts">
/**
 * Small "Documentation" link-button for showcase `PageHeader` actions — points
 * at the in-app `/docs/...` page(s) that explain the pattern the current
 * showcase route demonstrates. Resolution is tree-based (see
 * `resolveShowcaseDocs`) and re-runs reactively as `page.url` changes (e.g. tab
 * navigation). Renders nothing when the current route has no registered docs.
 *
 * Every button carries the same visible label — the registry's per-link `label`
 * is the disambiguator, surfaced as the hover tooltip and folded into the
 * accessible name so the ~28 routes registering two docs stay distinguishable
 * to screen readers (WCAG 2.4.4) despite reading identically on screen.
 */
import { page } from '$app/state';
import { Button } from '$lib/components/primitives';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { resolveShowcaseDocs } from '$lib/showcases/catalog/resolve-docs';

const entries = $derived(resolveShowcaseDocs(deLocalizeHref(page.url.pathname)));
</script>

{#if entries.length > 0}
	<nav class="showcase-docs" aria-label={m.showcase_docs_aria()}>
		{#each entries as entry (entry.href)}
			<Button
				href={localizeHref(entry.href)}
				variant="ghost"
				size="sm"
				title={entry.label}
				aria-label={entry.label ? `${m.showcase_docs_button()}: ${entry.label}` : undefined}
			>
				<span class="i-lucide-book-open mr-2 text-icon-sm" aria-hidden="true"></span>
				{m.showcase_docs_button()}
			</Button>
		{/each}
	</nav>
{/if}

<style>
	.showcase-docs {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}
</style>
