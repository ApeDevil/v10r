<script lang="ts">
/**
 * IMPRESSUM — provider identification under § 5 DDG and § 18 Abs. 2 MStV.
 *
 * ## Why this page is not translated
 *
 * The German text is the legally operative one. A translated Impressum is not
 * a second Impressum — it is a copy that can drift from the original, and the
 * drift is the liability. So the statutory blocks below are literal German in
 * every locale (standard practice on multilingual German sites), with a short
 * English courtesy note pointing at what the page is. Nothing here goes through
 * Paraglide, deliberately.
 *
 * ## Why the address is plain text
 *
 * It has to be. § 5 DDG requires the data be *leicht erkennbar, unmittelbar
 * erreichbar und ständig verfügbar*. Rendering it as an image or assembling it
 * in JS defeats screen readers and the "ständig verfügbar" limb, while OCR and
 * headless fetchers read it anyway — the obfuscation costs the legal safety and
 * buys nothing. Harvesting is fought at the distribution layer instead: the
 * `X-Robots-Tag` in +page.server.ts, the <meta> below, the AI-crawler block in
 * robots.txt, and absence from sitemap.xml.
 *
 * The identity itself is the site-operator record (`#lib/server/legal`), shared
 * with /datenschutz so the two legal pages cannot name different people.
 *
 * NOTE: no schema.org/PostalAddress JSON-LD. Structured data would hand a
 * harvester a typed, parsed record instead of prose. Do not add it.
 */
import { Card, PageHeader } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';

let { data } = $props();
const operator = $derived(data.operator);
</script>

<svelte:head>
	<title>Impressum — v10r</title>
	<meta name="robots" content="noindex, noarchive, nosnippet" />
	<meta name="description" content="Anbieterkennzeichnung nach § 5 DDG." />
</svelte:head>

<PageHeader title="Impressum" description="Angaben gemäß § 5 DDG und § 18 Abs. 2 MStV" />

<div class="impressum">
	<Card>
		<Stack gap="6">
			<section>
				<h2>Angaben gemäß § 5 DDG</h2>
				<address>
					{operator.name}<br />
					{operator.street}<br />
					{operator.postalCode} {operator.city}<br />
					{operator.country}
				</address>
			</section>

			<section>
				<h2>Kontakt</h2>
				<p>
					E-Mail: <a href="mailto:{operator.email}">{operator.email}</a>
				</p>
			</section>

			<section>
				<h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
				<p>{operator.name}, Anschrift wie oben</p>
			</section>

			<section>
				<h2>Zentrale Kontaktstelle nach Art. 11 und Art. 12 DSA</h2>
				<p>
					E-Mail: <a href="mailto:{operator.email}">{operator.email}</a><br />
					Sprachen: {operator.contactLanguages}
				</p>
				<p class="note">
					Die Kontaktstelle ist unmittelbar und direkt erreichbar; die Kommunikation erfolgt nicht
					ausschließlich über automatisierte Werkzeuge.
				</p>
			</section>

			<section>
				<h2>Verbraucherstreitbeilegung</h2>
				<p>
					Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
					Verbraucherschlichtungsstelle teilzunehmen.
				</p>
			</section>

			<section class="courtesy">
				<h2>Legal notice</h2>
				<p>
					This page is the provider identification required of German site operators by § 5 DDG and
					§ 18 (2) MStV. The German text above is the legally binding version. For data protection
					information see the <a href={localizeHref('/datenschutz')}>privacy policy (Datenschutzerklärung)</a>; to report unlawful content, use the contact address
					above.
				</p>
			</section>
		</Stack>
	</Card>
</div>

<style>
	.impressum {
		max-width: 44rem;
		margin: 0 auto;
		padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
	}

	h2 {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	address,
	p {
		margin: 0;
		font-size: var(--text-fluid-base);
		line-height: 1.65;
		color: var(--color-fg);
	}

	/* <address> is the correct element for contact data; undo its italic default. */
	address {
		font-style: normal;
	}

	p + p {
		margin-top: var(--spacing-3);
	}

	.note {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.courtesy {
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.courtesy p {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
