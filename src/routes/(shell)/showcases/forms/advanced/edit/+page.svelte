<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Select, Spinner, Switch, Textarea } from '$lib/components/primitives';
import { profileEditSchema } from '$lib/schemas/showcase/advanced';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance,
	submitting,
	delayed,
	tainted,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(profileEditSchema),
});

const roleOptions = [
	{ value: 'viewer', label: 'Viewer' },
	{ value: 'editor', label: 'Editor' },
	{ value: 'admin', label: 'Admin' },
	{ value: 'owner', label: 'Owner' },
];
</script>

<svelte:head>
	<title>Edit - Advanced - Showcases - Velociraptor</title>
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
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="name"
						bind:value={$form.name}
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
						error={!!$errors.email}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label="Role" error={$errors.role?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="role" value={$form.role} />
					<Select options={roleOptions} bind:value={$form.role} error={!!$errors.role} />
				{/snippet}
			</FormField>

			<FormField label="Bio" error={$errors.bio?.[0]} description="Max 300 characters">
				{#snippet children({ fieldId, describedBy })}
					<Textarea
						id={fieldId}
						name="bio"
						bind:value={$form.bio}
						placeholder="Tell us about yourself..."
						rows={3}
						error={!!$errors.bio}
						aria-describedby={describedBy}
					/>
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
