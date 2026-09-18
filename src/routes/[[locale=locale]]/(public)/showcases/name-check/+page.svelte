<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { page } from '$app/state';
import { Alert, Card, FormField, NavSection, ShowcaseLayout } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Input, Select, Skeleton, Typography } from '$lib/components/primitives';
import { ConflictSignalCard, CoverageTable, DomainTable, MatchList } from '$lib/components/showcases/name-check';
import type { DomainNameMatch } from '$lib/name-check/report';
import { baseLocale, extractLocaleFromUrl } from '$lib/paraglide/runtime';
import {
	NAME_CHECK_CATEGORIES,
	NAME_CHECK_QUERY_MAX_LENGTH,
	NAME_CHECK_TERRITORIES,
	type NameCheckCategory,
	type NameCheckTerritory,
	nameCheckFormSchema,
} from '$lib/schemas/name-check';
import { getShowcaseCard } from '../showcases';
import type { PageProps } from './$types';

let { data, form: actionResult }: PageProps = $props();

const card = getShowcaseCard('/showcases/name-check');

// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance,
	submitting,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(nameCheckFormSchema),
	// Superforms v2 resets a valid form after success; the name must stay so the reader
	// can compare the report with what they typed and adjust the territory or category.
	resetForm: false,
});

/** The action returns `{ form, report }`; the same object serves the no-JS render and the enhanced one. */
const report = $derived(actionResult?.report ?? null);
const reasons = $derived(actionResult?.reasons ?? []);
const headline = $derived(actionResult?.headline ?? '');
const labels = $derived(data.labels);
const copy = $derived(labels.copy);

/** The app locale; the formatters map it to an Intl locale themselves. */
const locale = $derived(extractLocaleFromUrl(page.url.href) ?? baseLocale);

const formError = $derived(
	$formMessage === 'rate_limited' ? copy.error_rate_limited : $formMessage === 'rejected' ? copy.error_rejected : null,
);

const territoryOptions = $derived(NAME_CHECK_TERRITORIES.map((value) => ({ value, label: labels.territories[value] })));
const categoryOptions = $derived([
	{ value: '', label: copy.category_none },
	...NAME_CHECK_CATEGORIES.map((value) => ({ value, label: labels.categories[value] })),
]);

const trademarks = $derived(report?.matches.filter((match) => match.kind === 'trademark') ?? []);
const companies = $derived(report?.matches.filter((match) => match.kind === 'company') ?? []);
const domains = $derived((report?.matches.filter((match) => match.kind === 'domain') ?? []) as DomainNameMatch[]);
const webUses = $derived(report?.matches.filter((match) => match.kind === 'web') ?? []);

const sections = $derived([
	{ id: 'nc-signal', label: copy.section_signal },
	{ id: 'nc-trademarks', label: copy.section_trademarks },
	{ id: 'nc-companies', label: copy.section_companies },
	{ id: 'nc-domains', label: copy.section_domains },
	{ id: 'nc-web', label: copy.section_web },
	{ id: 'nc-coverage', label: copy.section_coverage },
]);
</script>

<ShowcaseLayout {card}>
	<Stack gap="6">
		<p class="lede">{copy.lede}</p>

		<Card id="nc-check">
			<form method="POST" action="?/check" use:enhance>
				<Stack gap="5">
					<FormField
						label={copy.field_name_label}
						id="name-check-query"
						required
						error={$errors.query?.[0]}
					>
						{#snippet children({ fieldId, describedBy })}
							<Input
								id={fieldId}
								name="query"
								type="text"
								bind:value={$form.query}
								aria-describedby={describedBy}
								aria-invalid={$errors.query ? true : undefined}
								required
								maxlength={NAME_CHECK_QUERY_MAX_LENGTH}
								autocomplete="off"
								placeholder={copy.field_name_placeholder}
							/>
						{/snippet}
					</FormField>

					<div class="options">
						<FormField label={copy.field_territory_label} id="name-check-territory">
							{#snippet children({ fieldId })}
								<Select
									options={territoryOptions}
									value={$form.territory ?? 'worldwide'}
									onchange={(value) => ($form.territory = value as NameCheckTerritory)}
								/>
								<!-- The Select is display-only; this input is what the form actually submits. -->
								<input type="hidden" id={fieldId} name="territory" value={$form.territory ?? 'worldwide'} />
							{/snippet}
						</FormField>

						<FormField label={copy.field_category_label} id="name-check-category">
							{#snippet children({ fieldId })}
								<Select
									options={categoryOptions}
									value={$form.category ?? ''}
									onchange={(value) => ($form.category = value === '' ? null : (value as NameCheckCategory))}
									placeholder={copy.category_none}
								/>
								<input type="hidden" id={fieldId} name="category" value={$form.category ?? ''} />
							{/snippet}
						</FormField>
					</div>

					<input type="hidden" name="nonce" value={$form.nonce} />
					<input type="hidden" name="renderedAt" value={$form.renderedAt} />

					<!-- Honeypot — visually hidden, must remain empty. -->
					<div class="honeypot" aria-hidden="true">
						<label for="name-check-bookmark">Bookmark</label>
						<input
							id="name-check-bookmark"
							name="bookmark"
							type="text"
							tabindex="-1"
							autocomplete="off"
							bind:value={$form.bookmark}
						/>
					</div>

					{#if formError}
						<Alert variant="error" title={formError} description={copy.error_retry} />
					{/if}

					<div class="actions">
						<Button type="submit" variant="primary" size="md" disabled={$submitting}>
							{$submitting ? copy.submitting : copy.submit}
						</Button>
						<span class="text-muted text-fluid-sm">{copy.submit_note}</span>
					</div>
				</Stack>
			</form>
		</Card>

		{#if $submitting}
			<div class="pending" aria-busy="true" aria-live="polite">
				<Skeleton height="5rem" />
				<Skeleton height="9rem" />
				<Skeleton height="9rem" />
			</div>
		{:else if report}
			<NavSection {sections} />

			<section id="nc-signal" class="result-section">
				<ConflictSignalCard
					signal={report.signal}
					{headline}
					levelLabel={labels.levels[report.signal.level]}
					{reasons}
					{copy}
				/>
			</section>

			<Card id="nc-trademarks">
				{#snippet header()}
					<Typography variant="h2">{copy.section_trademarks}</Typography>
				{/snippet}
				<MatchList matches={trademarks} {labels} emptyText={copy.empty_trademarks} />
			</Card>

			<Card id="nc-companies">
				{#snippet header()}
					<Typography variant="h2">{copy.section_companies}</Typography>
				{/snippet}
				<MatchList matches={companies} {labels} emptyText={copy.empty_companies} />
			</Card>

			<Card id="nc-domains">
				{#snippet header()}
					<Typography variant="h2">{copy.section_domains}</Typography>
				{/snippet}
				{#if domains.length > 0}
					<DomainTable {domains} {labels} {locale} />
				{:else}
					<p class="text-muted text-fluid-sm">{copy.empty_domains}</p>
				{/if}
			</Card>

			<Card id="nc-web">
				{#snippet header()}
					<Typography variant="h2">{copy.section_web}</Typography>
				{/snippet}
				<MatchList matches={webUses} {labels} emptyText={copy.empty_web} />
			</Card>

			<Card id="nc-coverage">
				{#snippet header()}
					<Typography variant="h2">{copy.section_coverage}</Typography>
				{/snippet}
				<Stack gap="3">
					<CoverageTable coverage={report.coverage} {labels} {locale} />
					<p class="text-muted text-fluid-sm">{copy.coverage_note}</p>
				</Stack>
			</Card>
		{/if}

		<Alert
			variant="info"
			title={copy.disclaimer_title}
			description={copy.disclaimer_body}
		/>
	</Stack>
</ShowcaseLayout>

<style>
.lede {
	max-width: 68ch;
	font-size: var(--text-fluid-lg);
	margin: 0;
}

.options {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	gap: var(--spacing-4);
}

.actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--spacing-3);
}

.pending {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4);
}

.result-section {
	scroll-margin-top: 5rem;
}

/* Honeypot — keep accessible but invisible to humans + autofill blockers */
.honeypot {
	position: absolute;
	left: -10000px;
	top: auto;
	width: 1px;
	height: 1px;
	overflow: hidden;
}
</style>
