<script lang="ts">
/**
 * /credits — attribution/colophon for the stack. Fully static: every entry
 * comes from `$lib/credits/registry`, no load function needed. See
 * `registry.gate.test.ts` for the drift checks (license/docs/showcase links).
 */
import { Card, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';
import { creditGroups, credits } from '$lib/credits/registry';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

// Static input, computed once — no reactivity needed.
const groupedCredits = creditGroups.map((group) => ({
	group,
	entries: credits.filter((entry) => entry.group === group.id),
}));
</script>

<svelte:head>
	<title>{m.credits_meta_title()}</title>
	<meta name="description" content={m.credits_meta_description()} />
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader title={m.credits_title()} description={m.credits_lede()} />

	<Stack gap="7" class="py-6">
		{#each groupedCredits as { group, entries } (group.id)}
			<section aria-labelledby="credits-{group.id}-heading">
				<h2 id="credits-{group.id}-heading" class="credits-group-title">{group.label()}</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each entries as entry (entry.id)}
						<article class="credit-card relative flex flex-col gap-3 px-fluid-4 py-fluid-4 bg-surface-1 border border-border rounded-lg transition-colors duration-fast hover:border-primary">
							<div class="flex items-start justify-between gap-3">
								<h3 class="credit-name">{entry.name}</h3>
								<span class="credit-chip">{entry.license ?? m.credits_service_badge()}</span>
							</div>

							<p class="credit-role">{entry.role()}</p>

							<div class="credit-links">
								<a href={entry.url} target="_blank" rel="noopener noreferrer" class="credit-link">
									{m.credits_link_website()}
									<span class="i-lucide-external-link" aria-hidden="true"></span>
								</a>
								{#if entry.docs}
									<a href={localizeHref(entry.docs)} class="credit-link">{m.credits_link_docs()}</a>
								{/if}
								{#if entry.showcase}
									<a href={localizeHref(entry.showcase)} class="credit-link">{m.credits_link_showcase()}</a>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/each}

		<Card>
			<Stack gap="3">
				<p class="credits-outro-text">{m.credits_outro_source()}</p>
				<div class="credits-outro-links">
					<a
						href="https://github.com/ApeDevil/v10r"
						target="_blank"
						rel="noopener noreferrer"
						class="credit-link"
					>
						<span class="i-lucide-github" aria-hidden="true"></span>
						GitHub
					</a>
					<a
						href="https://gitlab.com/ApeDevil/v10r"
						target="_blank"
						rel="noopener noreferrer"
						class="credit-link"
					>
						<span class="i-lucide-gitlab" aria-hidden="true"></span>
						GitLab
					</a>
				</div>
				<p class="credits-outro-text">{m.credits_outro_license()}</p>
			</Stack>
		</Card>
	</Stack>
</PageContainer>

<style>
	.credits-group-title {
		margin: 0 0 var(--spacing-4);
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.credit-card {
		box-sizing: border-box;
	}

	.credit-card:hover {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translateY(-2px);
	}

	:global(.dark) .credit-card:hover {
		box-shadow:
			0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent),
			0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.credit-card {
			transition: none;
		}

		.credit-card:hover {
			transform: none;
		}
	}

	.credit-name {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
	}

	.credit-chip {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		padding: 1px var(--spacing-2);
		border-radius: var(--radius-full);
		background: var(--color-subtle);
		color: var(--color-muted);
		white-space: nowrap;
	}

	.credit-role {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
		color: var(--color-muted);
		flex: 1;
	}

	.credit-links,
	.credits-outro-links {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-1) var(--spacing-4);
	}

	.credit-links {
		margin-top: auto;
		padding-top: var(--spacing-1);
	}

	.credit-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.credit-link:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	.credit-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	@media (prefers-reduced-motion: reduce) {
		.credit-link {
			transition: none;
		}
	}

	.credits-outro-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-muted);
	}
</style>
