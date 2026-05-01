<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Input, Select, Textarea } from '$lib/components/primitives';
import { feedbackSubmissionSchema } from '$lib/server/feedback/validation';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

const { form, errors, enhance, submitting } = superForm(data.form, {
	validators: valibotClient(feedbackSubmissionSchema),
});

const ratingOptions = [
	{ value: '', label: 'No rating' },
	{ value: '1', label: '1 — needs work' },
	{ value: '2', label: '2' },
	{ value: '3', label: '3 — okay' },
	{ value: '4', label: '4' },
	{ value: '5', label: '5 — great' },
];
</script>

<svelte:head>
	<title>Send feedback · v10r.dev</title>
	<meta name="description" content="Tell us what worked, what didn't, or what you'd like to see." />
</svelte:head>

<div class="feedback-page">
	<Stack gap="6">
		<header class="feedback-header">
			<h1 class="feedback-title">Send feedback</h1>
			<p class="feedback-lede">
				Tell us what worked, what didn't, or what you'd like to see. Replies are not guaranteed.
			</p>
		</header>

		<aside class="privacy-notice" role="note" aria-label="Privacy notice">
			<p class="privacy-title">What we do with your message</p>
			<p>
				Controller: <a href="mailto:stas-k@gmx.de">stas-k@gmx.de</a>. We process your submission to respond to your feedback
				(lawful basis: legitimate interests, Art. 6(1)(f) GDPR). Messages are retained until you ask us to delete them.
				You have the right to access, correct, or erase your data — email the controller, or read the full
				disclosure at <a href="/showcases/admin">/showcases/admin</a>.
			</p>
		</aside>

		<Card>
			<form method="POST" use:enhance>
				<Stack gap="5">
					<FormField label="Subject" id="feedback-subject" required error={$errors.subject?.[0]}>
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
								placeholder="Short summary"
							/>
						{/snippet}
					</FormField>

					<FormField
						label="Message"
						id="feedback-body"
						required
						description="Up to 4000 characters."
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
								placeholder="What happened, what worked, what you'd change…"
							/>
						{/snippet}
					</FormField>

					<FormField label="Rating" id="feedback-rating" description="Optional. How would you rate this experience?">
						{#snippet children({ fieldId })}
							<Select
								name="rating"
								options={ratingOptions}
								value={$form.rating == null ? '' : String($form.rating)}
								onchange={(value) => ($form.rating = value === '' ? null : Number(value))}
								placeholder="No rating"
							/>
							<input type="hidden" id={fieldId} value={$form.rating ?? ''} />
						{/snippet}
					</FormField>

					<FormField
						label="Contact email"
						id="feedback-email"
						description="Optional — only if you'd like a reply."
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

					<!-- Hidden technical fields -->
					<input type="hidden" name="nonce" value={$form.nonce} />
					<input type="hidden" name="renderedAt" value={$form.renderedAt} />
					<input type="hidden" name="pageOfOrigin" value={$form.pageOfOrigin} />

					<!-- Honeypot — visually hidden, must remain empty. -->
					<div class="honeypot" aria-hidden="true">
						<label for="feedback-website">Website</label>
						<input
							id="feedback-website"
							name="website"
							type="text"
							tabindex="-1"
							autocomplete="off"
							bind:value={$form.website}
						/>
					</div>

					<div class="actions">
						<Button type="submit" variant="primary" size="md" disabled={$submitting}>
							{$submitting ? 'Sending…' : 'Send feedback'}
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

	.privacy-notice {
		padding: var(--spacing-3) var(--spacing-4);
		border-left: 2px solid var(--color-border);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.privacy-notice p {
		margin: 0;
	}

	.privacy-title {
		font-weight: 600;
		color: var(--color-fg);
	}

	.privacy-notice a {
		color: var(--color-fg);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
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
