<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Accordion, Button, Checkbox, Input, Select, Textarea } from '#lib/components/primitives/index.ts';
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '#lib/feedback/category.ts';
import { feedbackCategoryLabel } from '#lib/feedback/labels.ts';
import { feedbackSubmissionSchema } from '#lib/feedback/validation.ts';
import * as m from '#lib/paraglide/messages.js';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

const {
	form,
	errors,
	enhance,
	submitting,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(feedbackSubmissionSchema),
});

// Server actions send stable codes, not copy — i18n stays client-side.
const formError = $derived(
	$formMessage === 'rate_limited'
		? m.feedback_error_rate_limited()
		: $formMessage === 'rejected'
			? m.feedback_error_rejected()
			: $formMessage === 'inbox_full'
				? m.feedback_error_inbox_full()
				: null,
);

const categoryOptions = $derived(FEEDBACK_CATEGORIES.map((value) => ({ value, label: feedbackCategoryLabel(value) })));

// Exactly what the context checkbox attaches — the list is the consent text.
const contextItems = $derived(
	[
		$form.pageOfOrigin && m.feedback_context_page({ page: $form.pageOfOrigin }),
		$form.routeId && m.feedback_context_area({ area: $form.routeId }),
		$form.errorId && m.feedback_context_error({ errorId: $form.errorId }),
		data.appVersion && m.feedback_context_version({ version: data.appVersion.slice(0, 12) }),
		m.feedback_context_journey(),
	].filter(Boolean) as string[],
);

const ratingOptions = $derived([
	{ value: '', label: m.feedback_field_rating_none() },
	{ value: '1', label: m.feedback_field_rating_1() },
	{ value: '2', label: '2' },
	{ value: '3', label: m.feedback_field_rating_3() },
	{ value: '4', label: '4' },
	{ value: '5', label: m.feedback_field_rating_5() },
]);

const emailDescription = $derived(
	data.emailPrefilled ? m.feedback_field_email_prefilled() : m.feedback_field_email_description(),
);

const privacyItems = $derived([
	{
		value: 'privacy',
		title: m.feedback_privacy_title(),
		content: m.feedback_privacy_body(),
	},
]);

let privacyOpen = $state('');
</script>

<svelte:head>
	<meta name="description" content="Stack critique welcome — if you'd have made different choices, say so." />
</svelte:head>

<div class="feedback-page">
	<Stack gap="6">
		<header class="feedback-header">
			<h1 class="feedback-title">{m.feedback_title()}</h1>
			<p class="feedback-lede">
				{m.feedback_lede()}
			</p>
		</header>

		<Card>
			<form method="POST" use:enhance>
				<Stack gap="5">
					<FormField label={m.feedback_field_category_label()} id="feedback-category" required>
						{#snippet children({ fieldId })}
							<Select
								options={categoryOptions}
								value={$form.category}
								onchange={(value) => ($form.category = value as FeedbackCategory)}
							/>
							<!-- The Select is display-only; this input is what the form actually submits. -->
							<input type="hidden" id={fieldId} name="category" value={$form.category} />
						{/snippet}
					</FormField>

					<FormField label={m.feedback_field_subject_label()} id="feedback-subject" required error={$errors.subject?.[0]}>
						{#snippet children({ fieldId, describedBy })}
							<Input
								id={fieldId}
								name="subject"
								type="text"
								bind:value={$form.subject}
								aria-describedby={describedBy}
								aria-invalid={$errors.subject ? true : undefined}
								required
								maxlength={120}
								placeholder={m.feedback_field_subject_placeholder()}
							/>
						{/snippet}
					</FormField>

					<FormField
						label={m.feedback_field_message_label()}
						id="feedback-body"
						required
						error={$errors.body?.[0]}
					>
						{#snippet children({ fieldId, describedBy })}
							<Textarea
								id={fieldId}
								name="body"
								bind:value={$form.body}
								aria-describedby={describedBy}
								aria-invalid={$errors.body ? true : undefined}
								required
								rows={8}
								maxlength={4000}
								placeholder={m.feedback_field_message_placeholder()}
							/>
						{/snippet}
					</FormField>

					<FormField label={m.feedback_field_rating_label()} id="feedback-rating">
						{#snippet children({ fieldId })}
							<Select
								options={ratingOptions}
								value={$form.rating == null ? '' : String($form.rating)}
								onchange={(value) => ($form.rating = value === '' ? null : Number(value))}
								placeholder={m.feedback_field_rating_none()}
							/>
							<!-- The Select is display-only; this input is what the form actually submits. -->
							<input type="hidden" id={fieldId} name="rating" value={$form.rating ?? ''} />
						{/snippet}
					</FormField>

					<FormField
						label={m.feedback_field_email_label()}
						id="feedback-email"
						description={emailDescription}
						error={$errors.contactEmail?.[0]}
					>
						{#snippet children({ fieldId, describedBy })}
							<Input
								id={fieldId}
								name="contactEmail"
								type="email"
								bind:value={$form.contactEmail}
								aria-describedby={describedBy}
								aria-invalid={$errors.contactEmail ? true : undefined}
								autocomplete="email"
								placeholder=""
							/>
						{/snippet}
					</FormField>

					<div class="context-choice">
						<Checkbox name="includeContext" bind:checked={$form.includeContext} label={m.feedback_context_label()} />
						<ul class="context-list" aria-label={m.feedback_context_label()}>
							{#each contextItems as item (item)}
								<li><code>{item}</code></li>
							{/each}
						</ul>
						<p class="context-note">{m.feedback_context_note()}</p>
					</div>

					<!-- Hidden technical fields -->
					<input type="hidden" name="nonce" value={$form.nonce} />
					<input type="hidden" name="renderedAt" value={$form.renderedAt} />
					<input type="hidden" name="pageOfOrigin" value={$form.pageOfOrigin} />
					<input type="hidden" name="routeId" value={$form.routeId} />
					<input type="hidden" name="errorId" value={$form.errorId} />

					<!-- Honeypot — visually hidden, must remain empty. -->
					<div class="honeypot" aria-hidden="true">
						<label for="feedback-bookmark">Bookmark</label>
						<input
							id="feedback-bookmark"
							name="bookmark"
							type="text"
							tabindex="-1"
							autocomplete="off"
							bind:value={$form.bookmark}
						/>
					</div>

					<Accordion items={privacyItems} bind:value={privacyOpen} variant="bordered" size="sm" />

					{#if formError}
						<Alert variant="error" title={formError} description={m.feedback_error_retry()} />
					{/if}

					<div class="actions">
						<Button type="submit" variant="primary" size="md" disabled={$submitting}>
							{$submitting ? m.feedback_submitting() : m.feedback_submit()}
						</Button>
					</div>
				</Stack>
			</form>
		</Card>
	</Stack>
</div>

<style>
	.feedback-page {
		max-width: 42rem;
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	.feedback-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.feedback-title {
		margin: 0;
		font-size: var(--text-fluid-2xl, 1.5rem);
		font-weight: 600;
		color: var(--color-fg);
	}

	.feedback-lede {
		margin: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.context-choice {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.context-list {
		margin: 0;
		padding: 0 0 0 var(--spacing-7);
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		word-break: break-all;
	}

	.context-note {
		margin: 0;
		padding-left: var(--spacing-7);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
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
