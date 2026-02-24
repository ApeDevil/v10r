<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { contactSchema } from '$lib/schemas/forms-showcase/basics';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, message: formMessage } = superForm(data.form, {
		validators: valibotClient(contactSchema),
		delayMs: 150,
	});
</script>

<svelte:head>
	<title>Contact - Forms - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Contact Form</h2>
			<p class="text-fluid-sm text-muted">Standard form with progressive enhancement. Works with and without JavaScript.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Name" error={$errors.name?.[0]} required>
				{#snippet children({ fieldId, errorId, descId })}
					<Input
						id={fieldId}
						name="name"
						bind:value={$form.name}
						placeholder="Your full name"
						error={!!$errors.name}
						aria-describedby={$errors.name ? errorId : descId}
					/>
				{/snippet}
			</FormField>

			<FormField label="Email" error={$errors.email?.[0]} required>
				{#snippet children({ fieldId, errorId, descId })}
					<Input
						id={fieldId}
						name="email"
						type="email"
						bind:value={$form.email}
						placeholder="you@example.com"
						error={!!$errors.email}
						aria-describedby={$errors.email ? errorId : descId}
					/>
				{/snippet}
			</FormField>

			<FormField label="Subject" error={$errors.subject?.[0]} required>
				{#snippet children({ fieldId, errorId, descId })}
					<Input
						id={fieldId}
						name="subject"
						bind:value={$form.subject}
						placeholder="What is this about?"
						error={!!$errors.subject}
						aria-describedby={$errors.subject ? errorId : descId}
					/>
				{/snippet}
			</FormField>

			<FormField label="Message" error={$errors.message?.[0]} required>
				{#snippet children({ fieldId, errorId, descId })}
					<textarea
						id={fieldId}
						name="message"
						bind:value={$form.message}
						placeholder="Your message (min 10 characters)..."
						rows="5"
						class="form-textarea"
						aria-invalid={$errors.message ? 'true' : undefined}
						aria-describedby={$errors.message ? errorId : descId}
					></textarea>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Send Message
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Progressive Enhancement">
		{#snippet children()}
			<p>This form uses <code>use:enhance</code> for client-side validation and smooth UX. Disable JavaScript to see it still works via standard HTML form submission.</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.form-textarea {
		width: 100%;
		min-height: 8rem;
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

	.form-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}
</style>
