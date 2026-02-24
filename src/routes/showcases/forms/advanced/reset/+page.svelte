<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { feedbackSchema } from '$lib/schemas/forms-showcase/advanced';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Checkbox, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, message: formMessage } = superForm(data.form, {
		validators: valibotClient(feedbackSchema),
		resetForm: true,
		delayMs: 150,
	});

	const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
</script>

<svelte:head>
	<title>Reset - Forms - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Feedback with Auto-Reset</h2>
			<p class="text-fluid-sm text-muted">Form clears after successful submission via <code>resetForm: true</code>.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Thank You">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Rating" error={$errors.rating?.[0]} required>
				{#snippet children({ fieldId })}
					<div class="rating-group">
						<input
							id={fieldId}
							name="rating"
							type="range"
							min="1"
							max="5"
							bind:value={$form.rating}
							class="rating-input"
						/>
						<span class="rating-label">
							{#if $form.rating >= 1 && $form.rating <= 5}
								{$form.rating}/5 — {ratingLabels[$form.rating]}
							{:else}
								Slide to rate
							{/if}
						</span>
					</div>
				{/snippet}
			</FormField>

			<FormField label="Comment" error={$errors.comment?.[0]} required>
				{#snippet children({ fieldId, errorId, descId })}
					<textarea
						id={fieldId}
						name="comment"
						bind:value={$form.comment}
						placeholder="Tell us what you think (min 10 characters)..."
						rows="4"
						class="form-textarea"
						aria-invalid={$errors.comment ? 'true' : undefined}
						aria-describedby={$errors.comment ? errorId : descId}
					></textarea>
				{/snippet}
			</FormField>

			<FormField label="Recommendation">
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
					Submit Feedback
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
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}

	.form-textarea {
		width: 100%;
		min-height: 6rem;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-input-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		font-family: inherit;
		resize: vertical;
	}

	.form-textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

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
