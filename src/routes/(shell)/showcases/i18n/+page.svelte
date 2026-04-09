<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import {
	formatCurrency,
	formatDate,
	formatNumber,
	formatPercent,
	formatRelative,
	getFormattingLocale,
	tc,
} from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import {
	baseLocale,
	cookieMaxAge,
	cookieName,
	extractLocaleFromUrl,
	locales,
	localizeHref,
} from '$lib/paraglide/runtime';
import { setCookie } from '$lib/utils/cookies';

const LOCALE_NAMES: Record<string, string> = {
	en: 'English',
	de: 'Deutsch',
	fr: 'Français',
};

// Derive locale from reactive page.url (not getLocale() which reads window.location)
// so Svelte tracks it and {#key} triggers re-render on navigation
const currentLocale = $derived(extractLocaleFromUrl(page.url.href) ?? baseLocale);
const formattingLocale = $derived(getFormattingLocale());

// Client-side navigation avoids full page reloads that freeze Vite's
// HMR dev server. Paraglide's getLocale() reads from window.location.href,
// so after goto() the URL changes and all m.xxx() calls pick up the new locale.
let switching = $state(false);

async function switchLocale(event: Event, lang: string) {
	event.preventDefault();
	if (switching || lang === currentLocale) return;
	switching = true;
	// Update Paraglide's locale cookie so the server middleware resolves correctly
	setCookie(cookieName, lang, { maxAge: cookieMaxAge });
	await goto(localizeHref(page.url.pathname, { locale: lang }), { invalidateAll: true });
	switching = false;
}

// Sample dates and numbers for formatting demos
const sampleDate = new Date(2025, 0, 15, 14, 30);
const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const sampleNumber = 1234567.89;
const sampleCurrency = 1234.5;
const samplePercent = 0.8542;

// Simulated database content with translations
const dbContent = {
	title: { en: 'Hello World', de: 'Hallo Welt', fr: 'Bonjour le monde' },
	description: {
		en: 'This content is stored in the database as JSON.',
		de: 'Dieser Inhalt ist in der Datenbank als JSON gespeichert.',
		fr: 'Ce contenu est stocké dans la base de données en JSON.',
	},
};
</script>

<svelte:head>
	<title>{m.showcase_title()} - Showcases - Velociraptor</title>
</svelte:head>

{#key currentLocale}
<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_title()}
		description={m.showcase_description()}
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'i18n' }
		]}
	/>

	<!-- Language Switcher -->
	<section class="demo-section">
		<h2>{m.section_switcher()}</h2>
		<p>{m.locale_strategy()}</p>

		<div class="locale-info">
			<div class="info-row">
				<span class="info-label">{m.current_language()}:</span>
				<span class="info-value">{LOCALE_NAMES[currentLocale]} ({currentLocale})</span>
			</div>
			<div class="info-row">
				<span class="info-label">Formatting locale:</span>
				<span class="info-value">{formattingLocale}</span>
			</div>
		</div>

		<nav class="lang-switcher" aria-label="Language">
			{#each locales as lang}
				<a
					href={localizeHref(page.url.pathname, { locale: lang })}
					hreflang={lang}
					aria-current={lang === currentLocale ? 'page' : undefined}
					aria-disabled={switching}
					class="lang-link"
					class:active={lang === currentLocale}
					class:switching
					onclick={(e) => switchLocale(e, lang)}
				>
					{LOCALE_NAMES[lang]}
				</a>
			{/each}
		</nav>
	</section>

	<!-- Translated Messages -->
	<section class="demo-section">
		<h2>{m.section_messages()}</h2>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">m.greeting(&#123; name: 'World' &#125;)</span>
				<span class="demo-value">{m.greeting({ name: 'World' })}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">m.welcome_message()</span>
				<span class="demo-value">{m.welcome_message()}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">m.sample_text()</span>
				<span class="demo-value">{m.sample_text()}</span>
			</div>
		</div>
	</section>

	<!-- Pluralization -->
	<section class="demo-section">
		<h2>{m.section_pluralization()}</h2>
		<p>ICU MessageFormat handles pluralization rules per language.</p>

		<div class="message-demos">
			{#each [0, 1, 2, 5, 42] as count}
				<div class="demo-item">
					<span class="demo-label">m.items_count(&#123; count: {count} &#125;)</span>
					<span class="demo-value">{m.items_count({ count } as any)}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- Date & Number Formatting -->
	<section class="demo-section">
		<h2>{m.section_formatting()}</h2>
		<p>Formatting uses the browser's <code>Intl</code> API, decoupled from the translation locale. A German user in Switzerland gets German text but Swiss number formatting.</p>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">{m.formatted_date()}</span>
				<span class="demo-value">{formatDate(sampleDate)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_date()} (long)</span>
				<span class="demo-value">{formatDate(sampleDate, { dateStyle: 'full' })}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_number()}</span>
				<span class="demo-value">{formatNumber(sampleNumber)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_currency()} (EUR)</span>
				<span class="demo-value">{formatCurrency(sampleCurrency, 'EUR')}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_currency()} (USD)</span>
				<span class="demo-value">{formatCurrency(sampleCurrency, 'USD')}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_percent()}</span>
				<span class="demo-value">{formatPercent(samplePercent)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.formatted_relative()}</span>
				<span class="demo-value">{formatRelative(pastDate)}</span>
			</div>
		</div>
	</section>

	<!-- Database Content Translation -->
	<section class="demo-section">
		<h2>Content Translation (Database)</h2>
		<p>The <code>tc()</code> helper translates JSON fields from the database, falling back through: current locale → English → first available.</p>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">tc(post.title)</span>
				<span class="demo-value">{tc(dbContent.title)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">tc(post.description)</span>
				<span class="demo-value">{tc(dbContent.description)}</span>
			</div>
		</div>

		<div class="code-note">
			<h3>Database Schema Pattern</h3>
			<pre><code>// JSON columns for translated content
title: jsonb('title').$type&lt;Record&lt;string, string&gt;&gt;()
// Data: &#123; "en": "Hello", "de": "Hallo", "fr": "Bonjour" &#125;</code></pre>
		</div>
	</section>

	<!-- Type Safety -->
	<section class="demo-section">
		<h2>{m.section_type_safety()}</h2>
		<p>{m.type_safety_desc()}</p>

		<div class="code-note">
			<h3>Compile-time Guarantees</h3>
			<pre><code>// ✅ Type-safe with autocomplete
m.greeting(&#123; name: 'Alice' &#125;);

// ❌ Compile error — missing parameter
m.greeting();

// ❌ Compile error — unknown message key
m.unknownKey();</code></pre>
		</div>
	</section>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>
{/key}

<style>
	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	h3 {
		font-size: var(--text-fluid-lg);
		margin-top: var(--spacing-4);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	.demo-section {
		margin-bottom: var(--spacing-8);
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		background: var(--color-subtle);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
	}

	/* Locale info */
	.locale-info {
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		margin-bottom: var(--spacing-4);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) 0;
	}

	.info-label {
		font-weight: 500;
		color: var(--color-muted);
	}

	.info-value {
		font-weight: 600;
		font-family: ui-monospace, monospace;
	}

	/* Language switcher */
	.lang-switcher {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.lang-link {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		text-decoration: none;
		font-weight: 500;
	}

	.lang-link:hover {
		background: var(--color-subtle);
	}

	.lang-link.active {
		background: var(--color-primary);
		color: var(--color-bg);
		border-color: var(--color-primary);
	}

	.lang-link.switching {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Message demos */
	.message-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.demo-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.demo-label {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.demo-value {
		font-weight: 600;
		text-align: right;
	}

	/* Code notes */
	.code-note {
		margin-top: var(--spacing-4);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-left: 3px solid var(--color-primary);
		border-radius: var(--radius-sm);
	}

	.code-note h3 {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-primary);
	}

	.code-note pre {
		margin: 0;
		overflow-x: auto;
	}

	.code-note code {
		display: block;
		padding: var(--spacing-3);
		background: var(--color-bg);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		white-space: pre;
	}

	@media (max-width: 640px) {
		.demo-item {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--spacing-1);
		}

		.demo-value {
			text-align: left;
		}
	}
</style>
