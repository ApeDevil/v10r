<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Accordion, Button, Input, Select, Textarea } from '$lib/components/primitives';
import { feedbackSubmissionSchema } from '$lib/feedback/validation';
import * as m from '$lib/paraglide/messages';
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
			: null,
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

					{#if $form.pageOfOrigin}
						<FormField
							label={m.feedback_field_source_label()}
							id="feedback-source"
							description={m.feedback_field_source_description()}
						>
							{#snippet children({ fieldId })}
								<code id={fieldId} class="source-chip">{$form.pageOfOrigin}</code>
							{/snippet}
						</FormField>
					{/if}

					<!-- Hidden technical fields -->
					<input type="hidden" name="nonce" value={$form.nonce} />
					<input type="hidden" name="renderedAt" value={$form.renderedAt} />
					<input type="hidden" name="pageOfOrigin" value={$form.pageOfOrigin} />

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

	.source-chip {
		display: inline-block;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-subtle);
		font-family: var(--font-mono);
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		word-break: break-all;
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
