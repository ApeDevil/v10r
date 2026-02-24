<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { settingsSchema } from '$lib/schemas/forms-showcase/basics';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Select, Switch, Checkbox, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, tainted, message: formMessage } = superForm(data.form, {
		validators: valibotClient(settingsSchema),
		delayMs: 150,
	});

	const timezoneOptions = [
		{ value: 'utc', label: 'UTC' },
		{ value: 'est', label: 'Eastern (EST)' },
		{ value: 'cst', label: 'Central (CST)' },
		{ value: 'pst', label: 'Pacific (PST)' },
		{ value: 'cet', label: 'Central European (CET)' },
	];

	const languageOptions = [
		{ value: 'en', label: 'English' },
		{ value: 'es', label: 'Spanish' },
		{ value: 'fr', label: 'French' },
		{ value: 'de', label: 'German' },
		{ value: 'ja', label: 'Japanese' },
	];
</script>

<svelte:head>
	<title>Settings - Forms - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title="Saved">
			{#snippet children()}
				<p>{$formMessage}</p>
			{/snippet}
		</Alert>
	{/if}

	<form method="POST" use:enhance>
		<Stack gap="6">
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Profile</h2>
				{/snippet}

				<div class="form-grid">
					<FormField label="Display Name" error={$errors.displayName?.[0]} required>
						{#snippet children({ fieldId, errorId, descId })}
							<Input
								id={fieldId}
								name="displayName"
								bind:value={$form.displayName}
								error={!!$errors.displayName}
								aria-describedby={$errors.displayName ? errorId : descId}
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

					<FormField label="Website" error={$errors.website?.[0]} description="Optional. Must start with http:// or https://">
						{#snippet children({ fieldId, errorId, descId })}
							<Input
								id={fieldId}
								name="website"
								bind:value={$form.website}
								placeholder="https://yoursite.com"
								error={!!$errors.website}
								aria-describedby={$errors.website ? errorId : descId}
							/>
						{/snippet}
					</FormField>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Preferences</h2>
				{/snippet}

				<div class="form-grid">
					<FormField label="Timezone" error={$errors.timezone?.[0]} required>
						{#snippet children(_)}
							<input type="hidden" name="timezone" value={$form.timezone} />
							<Select options={timezoneOptions} bind:value={$form.timezone} />
						{/snippet}
					</FormField>

					<FormField label="Language" error={$errors.language?.[0]} required>
						{#snippet children(_)}
							<input type="hidden" name="language" value={$form.language} />
							<Select options={languageOptions} bind:value={$form.language} />
						{/snippet}
					</FormField>

					<FormField label="Public Profile">
						{#snippet children(_)}
							<input type="hidden" name="publicProfile" value={$form.publicProfile ? 'on' : ''} />
							<Switch bind:checked={$form.publicProfile} label={$form.publicProfile ? 'Visible' : 'Hidden'} />
						{/snippet}
					</FormField>
				</div>
			</Card>

			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Notifications</h2>
				{/snippet}

				<div class="form-grid">
					<FormField label="Email Notifications">
						{#snippet children(_)}
							<Checkbox
								name="emailNotifications"
								bind:checked={$form.emailNotifications}
								label="Receive email notifications for important updates"
							/>
						{/snippet}
					</FormField>

					<FormField label="Marketing Emails">
						{#snippet children(_)}
							<Checkbox
								name="marketingEmails"
								bind:checked={$form.marketingEmails}
								label="Receive marketing and promotional emails"
							/>
						{/snippet}
					</FormField>
				</div>
			</Card>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting || !$tainted}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{$tainted ? 'Save Changes' : 'No Changes'}
				</Button>
			</div>
		</Stack>
	</form>
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
	}
</style>
