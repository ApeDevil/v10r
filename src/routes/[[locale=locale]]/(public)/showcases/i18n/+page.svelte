<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { BackLink, NavSection, PageHeader, ShowcaseDocs } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { ErrorCode, errorMessage } from '$lib/errors';
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
	type Locale,
	locales,
	localizeHref,
} from '$lib/paraglide/runtime';
import { setCookie } from '$lib/utils/cookies';

const LOCALE_NAMES: Record<string, string> = {
	en: 'English',
	de: 'Deutsch',
	ru: 'Русский',
};

// Derive locale from reactive page.url (not getLocale() which reads window.location)
// so Svelte tracks it and {#key} triggers re-render on navigation
const currentLocale = $derived(extractLocaleFromUrl(page.url.href) ?? baseLocale);
const formattingLocale = $derived(getFormattingLocale(currentLocale));

// Client-side navigation avoids full page reloads that freeze Vite's
// HMR dev server. Paraglide's getLocale() reads from window.location.href,
// so after goto() the URL changes and all m.xxx() calls pick up the new locale.
let switching = $state(false);

async function switchLocale(event: Event, lang: Locale) {
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

// Simulated DB row: EN canonical + JSONB i18n sibling (mirrors blog.domain shape)
const dbContent = {
	title: 'Hello World',
	titleI18n: { de: 'Hallo Welt', ru: 'Привет, мир' } as const,
	description: 'This content is stored in the database as JSON.',
	descriptionI18n: {
		de: 'Dieser Inhalt ist in der Datenbank als JSON gespeichert.',
		ru: 'Это содержимое хранится в базе данных в формате JSON.',
	} as const,
};

const sections = $derived([
	{ id: 'i18n-switcher', label: m.showcase_i18n_section_switcher() },
	{ id: 'i18n-messages', label: m.showcase_i18n_section_messages() },
	{ id: 'i18n-pluralization', label: m.showcase_i18n_section_pluralization() },
	{ id: 'i18n-formatting', label: m.showcase_i18n_section_formatting() },
	{ id: 'i18n-content-translation', label: m.showcase_i18n_section_content_translation() },
	{ id: 'i18n-error-codes', label: m.showcase_i18n_section_error_codes() },
	{ id: 'i18n-type-safety', label: m.showcase_i18n_section_type_safety() },
]);
</script>
{#key currentLocale}
<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_i18n_title()}
		description={m.showcase_i18n_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_i18n_title() }
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavSection {sections} />

	<!-- Language Switcher -->
	<section class="demo-section" id="i18n-switcher">
		<h2>{m.showcase_i18n_section_switcher()}</h2>
		<p>{m.showcase_i18n_locale_strategy()}</p>

		<div class="locale-info">
			<div class="info-row">
				<span class="info-label">{m.showcase_i18n_current_language()}:</span>
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
	<section class="demo-section" id="i18n-messages">
		<h2>{m.showcase_i18n_section_messages()}</h2>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">m.showcase_i18n_greeting(&#123; name: 'World' &#125;)</span>
				<span class="demo-value">{m.showcase_i18n_greeting({ name: 'World' })}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">m.showcase_i18n_welcome_message()</span>
				<span class="demo-value">{m.showcase_i18n_welcome_message()}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">m.showcase_i18n_sample_text()</span>
				<span class="demo-value">{m.showcase_i18n_sample_text()}</span>
			</div>
		</div>
	</section>

	<!-- Pluralization -->
	<section class="demo-section" id="i18n-pluralization">
		<h2>{m.showcase_i18n_section_pluralization()}</h2>
		<p>ICU MessageFormat handles pluralization rules per language.</p>

		<div class="message-demos">
			{#each [0, 1, 2, 5, 42] as count}
				<div class="demo-item">
					<span class="demo-label">m.showcase_i18n_items_count(&#123; count: {count} &#125;)</span>
					<span class="demo-value">{m.showcase_i18n_items_count({ count } as any)}</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- Date & Number Formatting -->
	<section class="demo-section" id="i18n-formatting">
		<h2>{m.showcase_i18n_section_formatting()}</h2>
		<p>Formatting uses the browser's <code>Intl</code> API, decoupled from the translation locale.</p>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_date()}</span>
				<span class="demo-value">{formatDate(sampleDate, currentLocale)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_date()} (long)</span>
				<span class="demo-value">{formatDate(sampleDate, currentLocale, { dateStyle: 'full' })}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_number()}</span>
				<span class="demo-value">{formatNumber(sampleNumber, currentLocale)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_currency()} (EUR)</span>
				<span class="demo-value">{formatCurrency(sampleCurrency, currentLocale, 'EUR')}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_currency()} (USD)</span>
				<span class="demo-value">{formatCurrency(sampleCurrency, currentLocale, 'USD')}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_percent()}</span>
				<span class="demo-value">{formatPercent(samplePercent, currentLocale)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">{m.showcase_i18n_formatted_relative()}</span>
				<span class="demo-value">{formatRelative(pastDate, currentLocale)}</span>
			</div>
		</div>
	</section>

	<!-- Database Content Translation -->
	<section class="demo-section" id="i18n-content-translation">
		<h2>{m.showcase_i18n_section_content_translation()}</h2>
		<p>The <code>tc()</code> helper translates JSON fields from the database, falling back through: current locale → English → first available.</p>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">tc(post.title, post.titleI18n, locale)</span>
				<span class="demo-value">{tc(dbContent.title, dbContent.titleI18n, currentLocale)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">tc(post.description, post.descriptionI18n, locale)</span>
				<span class="demo-value">{tc(dbContent.description, dbContent.descriptionI18n, currentLocale)}</span>
			</div>
		</div>
	</section>

	<!-- Error Codes → Localized Messages -->
	<section class="demo-section" id="i18n-error-codes">
		<h2>{m.showcase_i18n_section_error_codes()}</h2>
		<p>Domain error <em>codes</em> resolve to localized strings via <code>errorMessage(code)</code>.</p>

		<div class="message-demos">
			<div class="demo-item">
				<span class="demo-label">errorMessage(ErrorCode.AUTH_INVALID)</span>
				<span class="demo-value">{errorMessage(ErrorCode.AUTH_INVALID)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">errorMessage(ErrorCode.VALIDATION_REQUIRED)</span>
				<span class="demo-value">{errorMessage(ErrorCode.VALIDATION_REQUIRED)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">errorMessage(ErrorCode.RATE_LIMITED)</span>
				<span class="demo-value">{errorMessage(ErrorCode.RATE_LIMITED)}</span>
			</div>
			<div class="demo-item">
				<span class="demo-label">errorMessage(ErrorCode.RESOURCE_NOT_FOUND)</span>
				<span class="demo-value">{errorMessage(ErrorCode.RESOURCE_NOT_FOUND)}</span>
			</div>
		</div>
	</section>

	<!-- Type Safety -->
	<section class="demo-section" id="i18n-type-safety">
		<h2>{m.showcase_i18n_section_type_safety()}</h2>
		<p>{m.showcase_i18n_type_safety_desc()}</p>
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

	.demo-section {
		scroll-margin-top: 5rem;
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
