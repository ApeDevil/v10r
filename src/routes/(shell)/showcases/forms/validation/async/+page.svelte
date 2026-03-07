<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { asyncSchema } from '$lib/schemas/showcase/validation';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Badge, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, message: formMessage } = superForm(data.form, {
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
				const { available } = await res.json();
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

<svelte:head>
	<title>Async - Validation - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Async Validation</h2>
			<p class="text-fluid-sm text-muted">Debounced server-side username check with loading indicator.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Username" error={$errors.username?.[0]} required>
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
							<span class="text-fluid-xs text-muted">Checking...</span>
						{:else if usernameAvailable === true}
							<Badge variant="success">Available</Badge>
						{:else if usernameAvailable === false}
							<Badge variant="error">Taken</Badge>
						{/if}
					</div>
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

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Register
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
