<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { profileEditSchema } from '$lib/schemas/forms-showcase/advanced';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Select, Switch, Badge, Spinner } from '$lib/components/primitives';
	import { Stack, Cluster } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, tainted, message: formMessage } = superForm(data.form, {
		validators: valibotClient(profileEditSchema),
		delayMs: 150,
	});

	const roleOptions = [
		{ value: 'viewer', label: 'Viewer' },
		{ value: 'editor', label: 'Editor' },
		{ value: 'admin', label: 'Admin' },
		{ value: 'owner', label: 'Owner' },
	];
</script>

<svelte:head>
	<title>Edit - Forms - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<div>
					<h2 class="text-fluid-lg font-semibold">Edit Profile</h2>
					<p class="text-fluid-sm text-muted">Pre-populated form. Save disabled until changes are detected.</p>
				</div>
				{#if $tainted}
					<Badge variant="warning">Unsaved Changes</Badge>
				{/if}
			</Cluster>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Saved">
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
						error={!!$errors.email}
						aria-describedby={$errors.email ? errorId : descId}
					/>
				{/snippet}
			</FormField>

			<FormField label="Role" error={$errors.role?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="role" value={$form.role} />
					<Select options={roleOptions} bind:value={$form.role} />
				{/snippet}
			</FormField>

			<FormField label="Bio" error={$errors.bio?.[0]} description="Max 300 characters">
				{#snippet children({ fieldId, errorId, descId })}
					<textarea
						id={fieldId}
						name="bio"
						bind:value={$form.bio}
						placeholder="Tell us about yourself..."
						rows="3"
						class="form-textarea"
						aria-invalid={$errors.bio ? 'true' : undefined}
						aria-describedby={$errors.bio ? errorId : descId}
					></textarea>
				{/snippet}
			</FormField>

			<FormField label="Status">
				{#snippet children(_)}
					<input type="hidden" name="active" value={$form.active ? 'on' : ''} />
					<Switch bind:checked={$form.active} label={$form.active ? 'Active' : 'Inactive'} />
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting || !$tainted}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{$tainted ? 'Save Changes' : 'No Changes'}
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Edit Pattern">
		{#snippet children()}
			<p>The form is pre-populated via <code>superValidate(existingData, valibot(schema))</code> on the server. <code>$tainted</code> tracks whether any field has changed from its initial value, enabling the Save button only when there are actual changes.</p>
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
		min-height: 5rem;
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
</style>
