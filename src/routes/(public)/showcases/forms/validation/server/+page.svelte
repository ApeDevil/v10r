<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { page } from '$app/state';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Input, Spinner } from '$lib/components/primitives';
import { serverSchema } from '$lib/schemas/showcase/validation';
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
	validators: valibotClient(serverSchema),
});

const isError = $derived(page.status >= 400);
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Server-Side Errors</h2>
			<p class="text-fluid-sm text-muted">Errors that only the server can detect: duplicate emails, expired codes.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant={isError ? 'error' : 'success'} title={isError ? 'Error' : 'Success'}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Email" error={$errors.email?.[0]} required description="Try an email containing 'taken' to trigger server error">
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="email"
						type="email"
						bind:value={$form.email}
						placeholder="you@example.com (or taken@test.com)"
						error={!!$errors.email}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label="Invite Code" error={$errors.inviteCode?.[0]} required description="Try EXPIRED1 or INVALID1 to trigger server errors">
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="inviteCode"
						bind:value={$form.inviteCode}
						placeholder="Enter invite code"
						error={!!$errors.inviteCode}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Join
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Server Error Patterns">
		{#snippet children()}
			<p><code>setError(form, 'field', 'msg')</code> adds per-field errors. <code>message(form, 'msg', {'{'} status: 400 {'}'})</code> sets a form-level message with error status. Both are used for conditions only the server can check (database lookups, rate limits, etc.).</p>
		{/snippet}
	</Alert>
</Stack>
