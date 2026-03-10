<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Input, Spinner } from '$lib/components/primitives';
import { contactSchema } from '$lib/schemas/showcase/basics';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

const {
	form,
	errors,
	enhance,
	submitting,
	delayed,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(contactSchema),
});
</script>

<svelte:head>
	<title>Contact - Basics - Showcases - Velociraptor</title>
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
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="name"
						bind:value={$form.name}
						placeholder="Your full name"
						error={!!$errors.name}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label="Email" error={$errors.email?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="email"
						type="email"
						bind:value={$form.email}
						placeholder="you@example.com"
						error={!!$errors.email}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label="Subject" error={$errors.subject?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="subject"
						bind:value={$form.subject}
						placeholder="What is this about?"
						error={!!$errors.subject}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label="Message" error={$errors.message?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<textarea
						id={fieldId}
						name="message"
						bind:value={$form.message}
						placeholder="Your message (min 10 characters)..."
						rows="5"
						class="form-textarea"
						aria-invalid={$errors.message ? 'true' : undefined}
						aria-describedby={describedBy}
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
