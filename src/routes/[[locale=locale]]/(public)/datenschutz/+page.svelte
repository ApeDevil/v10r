<script lang="ts">
/**
 * DATENSCHUTZERKLÄRUNG — the privacy policy of v10r.dev under GDPR Art. 13/14.
 *
 * One version per locale, so a visitor reads the policy in their own language
 * (Art. 12(1): "clear and plain language"). The German text is the legally binding
 * one; the English and Russian versions say so at the top and link to it. Long legal
 * prose does not go through Paraglide: each version is one component in `_policy/`,
 * mirroring PolicyDe.svelte section by section. Change all three together.
 *
 * Every section describes processing the code actually does — the categories match
 * the privacy showcase's data inventory, the periods come from the retention
 * schedule via the load. A new vendor, cookie or data category is added here in the
 * same change that adds it to the code.
 */
import { Card, PageHeader } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import PolicyDe from './_policy/PolicyDe.svelte';
import PolicyEn from './_policy/PolicyEn.svelte';
import PolicyRu from './_policy/PolicyRu.svelte';

let { data } = $props();

const versions = {
	de: {
		Policy: PolicyDe,
		title: 'Datenschutzerklärung',
		description: 'Informationen nach Art. 13 und 14 DSGVO',
		binding: null,
	},
	en: {
		Policy: PolicyEn,
		title: 'Privacy policy',
		description: 'Information under Art. 13 and 14 GDPR',
		binding: { text: 'This is a translation. Only the', link: 'German version', rest: 'is legally binding.' },
	},
	ru: {
		Policy: PolicyRu,
		title: 'Политика конфиденциальности',
		description: 'Информация согласно ст. 13 и 14 GDPR',
		binding: { text: 'Это перевод. Юридически обязательна только', link: 'немецкая версия', rest: '' },
	},
} as const;

const version = $derived(versions[data.locale as keyof typeof versions] ?? versions.en);
const facts = $derived({ operator: data.operator, cookieNames: data.cookies, retention: data.retention });
</script>

<svelte:head>
	<title>{version.title} — v10r</title>
	<meta name="robots" content="noindex, noarchive, nosnippet" />
	<meta name="description" content="{version.title}, v10r.dev — {version.description}." />
</svelte:head>

<PageHeader title={version.title} description={version.description} centered />

<div class="policy">
	<Card>
		<Stack gap="6">
			{#if version.binding}
				<p class="binding">
					{version.binding.text}
					<a href={localizeHref('/datenschutz', { locale: 'de' })} hreflang="de">{version.binding.link}</a>{version.binding.rest
						? ` ${version.binding.rest}`
						: '.'}
				</p>
			{/if}
			<version.Policy {...facts} />
		</Stack>
	</Card>
</div>

<style>
	.policy {
		max-width: 48rem;
		margin: 0 auto;
		padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
	}

	/* The policy text lives in the per-locale components in _policy/; it is styled
	   here once, so every version looks the same. */
	.policy :global(h2) {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.policy :global(:is(address, p, li)) {
		margin: 0;
		font-size: var(--text-fluid-base);
		line-height: 1.65;
		color: var(--color-fg);
	}

	/* <address> is the correct element for contact data; undo its italic default. */
	.policy :global(address) {
		font-style: normal;
	}

	.policy :global(:is(address, p, ul) + :is(p, ul, .table-wrap)) {
		margin-top: var(--spacing-3);
	}

	.policy :global(ul) {
		margin-bottom: 0;
		padding-left: var(--spacing-5);
	}

	.policy :global(:is(.basis, .note)),
	.binding {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.binding {
		margin: 0;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	/* width 0 + min-width 100%: the table scrolls inside the card instead of
	   widening it to its min-content width on a phone. */
	.policy :global(.table-wrap) {
		width: 0;
		min-width: 100%;
		overflow-x: auto;
	}

	.policy :global(table) {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.policy :global(:is(th, td)) {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		vertical-align: top;
		color: var(--color-fg);
	}

	.policy :global(th) {
		font-weight: 600;
		color: var(--color-muted);
	}

	.policy :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.policy :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.policy :global(a:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
