<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { asyncSchema } from '$lib/schemas/showcase/validation';
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
	validators: valibotClient(asyncSchema),
});

let usernameAvailable = $state<boolean | null>(null);
let checkingUsername = $state(false);
let debounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);

function checkUsername() {
	const username = $form.username;

	if (debounceTimer) clearTimeout(debounceTimer);
	usernameAvailable = null;

	if (username.length < 3 || !/^[a-z0-9_-]+$/.test(username)) {
		checkingUsername = false;
		return;
	}

	checkingUsername = true;
	debounceTimer = setTimeout(async () => {
		try {
			const res = await fetch(`/api/showcases/check-username?u=${encodeURIComponent(username)}`);
			const {
				data: { available },
			} = await res.json();
			// Only update if the username hasn't changed while we were checking
			if ($form.username === username) {
				usernameAvailable = available;
			}
		} finally {
			checkingUsername = false;
		}
	}, 400);
}
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_async_heading()}</h2>
			<p class="text-fluid-sm text-muted">Debounced server-side username check with loading indicator.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_success()}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label={m.showcase_forms_field_username()} error={$errors.username?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="username"
						bind:value={$form.username}
						placeholder="Check: admin, test, user, root"
						error={!!$errors.username}
						aria-describedby={describedBy}
						oninput={checkUsername}
					/>
					<div class="availability">
						{#if checkingUsername}
							<Spinner size="sm" variant="muted" />
							<span class="text-fluid-xs text-muted">{m.showcase_forms_async_checking()}</span>
						{:else if usernameAvailable === true}
							<Badge variant="success">{m.showcase_forms_async_available()}</Badge>
						{:else if usernameAvailable === false}
							<Badge variant="error">{m.showcase_forms_async_taken()}</Badge>
						{/if}
					</div>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_email()} error={$errors.email?.[0]} required>
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

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_async_register()}
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Async Check Pattern">
		{#snippet children()}
			<p>The username check uses a debounced <code>fetch</code> to <code>/api/showcases/check-username</code>, separate from Superforms validation. Try typing <strong>admin</strong>, <strong>test</strong>, <strong>user</strong>, or <strong>root</strong> to see "Taken".</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.availability {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 1.5rem;
		margin-top: var(--spacing-1);
	}
</style>
