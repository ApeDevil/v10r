<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Checkbox, Input, Spinner, Textarea } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { feedbackSchema } from '$lib/schemas/showcase/advanced';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance,
	submitting,
	delayed,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(feedbackSchema),
	resetForm: true,
});

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_reset_heading()}</h2>
			<p class="text-fluid-sm text-muted">Form clears after successful submission via <code>resetForm: true</code>.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_reset_thank_you()}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label={m.showcase_forms_field_rating()} error={$errors.rating?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<div class="rating-group">
						<input
							id={fieldId}
							name="rating"
							type="range"
							min="1"
							max="5"
							bind:value={$form.rating}
							aria-valuetext="{$form.rating}/5 — {ratingLabels[$form.rating] ?? 'Slide to rate'}"
							aria-describedby={describedBy}
							class="rating-input"
						/>
						<span class="rating-label">
							{#if $form.rating >= 1 && $form.rating <= 5}
								{$form.rating}/5 — {ratingLabels[$form.rating]}
							{:else}
								{m.showcase_forms_reset_slide_to_rate()}
							{/if}
						</span>
					</div>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_comment()} error={$errors.comment?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Textarea
						id={fieldId}
						name="comment"
						bind:value={$form.comment}
						placeholder="Tell us what you think (min 10 characters)..."
						rows={4}
						error={!!$errors.comment}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_recommendation()}>
				{#snippet children(_)}
					<Checkbox
						name="recommend"
						bind:checked={$form.recommend}
						label="I would recommend this to others"
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_reset_submit()}
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Reset Pattern">
		{#snippet children()}
			<p><code>resetForm: true</code> clears all fields back to their initial values after a successful server response. The success message persists via <code>$message</code>. Great for feedback forms, surveys, or any form where the user might want to submit again.</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.rating-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.rating-input {
		width: 100%;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.rating-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
