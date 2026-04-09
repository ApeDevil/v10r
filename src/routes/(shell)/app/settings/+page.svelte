<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Avatar, Button, Input, Select, Slider, Spinner, Switch, ToggleGroup } from '$lib/components/primitives';
import { userSettingsSchema } from '$lib/schemas/app/settings';
import { getSidebar } from '$lib/state/sidebar.svelte';
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
	validators: valibotClient(userSettingsSchema),
});

const sidebar = getSidebar();

let sliderValue = $state<number[]>([$form.sidebarWidth]);

const widthLabels: Record<number, string> = {
	160: 'Narrow',
	200: 'Compact',
	240: 'Default',
	280: 'Comfortable',
	320: 'Wide',
};

const currentWidthLabel = $derived(widthLabels[sliderValue[0]] ?? `${sliderValue[0]}px`);

// Bridge slider → form + live preview
$effect(() => {
	const px = sliderValue[0];
	if (px !== $form.sidebarWidth) {
		$form.sidebarWidth = px;
		sidebar.setWidth(px);
	}
});

// svelte-ignore state_referenced_locally
let avatarUrl = $state(data.avatarUrl);
let avatarError = $state('');
let avatarUploading = $state(false);

let fileInput: HTMLInputElement;

const themeItems = [
	{ value: 'light', label: 'Light' },
	{ value: 'system', label: 'System' },
	{ value: 'dark', label: 'Dark' },
];

const densityItems = [
	{ value: 'compact', label: 'Compact' },
	{ value: 'comfortable', label: 'Comfortable' },
	{ value: 'spacious', label: 'Spacious' },
];

const localeOptions = [
	{ value: 'en', label: 'English' },
	{ value: 'es', label: 'Spanish' },
	{ value: 'fr', label: 'French' },
	{ value: 'de', label: 'German' },
	{ value: 'ja', label: 'Japanese' },
];

const timezoneOptions = [
	{ value: 'UTC', label: 'UTC' },
	{ value: 'America/New_York', label: 'Eastern (US)' },
	{ value: 'America/Chicago', label: 'Central (US)' },
	{ value: 'America/Denver', label: 'Mountain (US)' },
	{ value: 'America/Los_Angeles', label: 'Pacific (US)' },
	{ value: 'Europe/London', label: 'London' },
	{ value: 'Europe/Berlin', label: 'Berlin' },
	{ value: 'Europe/Paris', label: 'Paris' },
	{ value: 'Asia/Tokyo', label: 'Tokyo' },
	{ value: 'Asia/Shanghai', label: 'Shanghai' },
	{ value: 'Australia/Sydney', label: 'Sydney' },
];

const dateFormatOptions = [
	{ value: 'relative', label: 'Relative (2 hours ago)' },
	{ value: 'absolute', label: 'Absolute (Mar 7, 2026)' },
	{ value: 'iso', label: 'ISO (2026-03-07)' },
];

async function handleAvatarUpload() {
	const file = fileInput?.files?.[0];
	if (!file) return;

	avatarError = '';
	avatarUploading = true;

	try {
		const body = new FormData();
		body.append('avatar', file);

		const res = await fetch('?/uploadAvatar', { method: 'POST', body });
		const result = await res.json();

		if (result.type === 'failure') {
			avatarError = result.data?.avatarError ?? 'Upload failed';
		} else {
			avatarUrl = result.data?.avatarUrl ?? avatarUrl;
		}
	} catch {
		avatarError = 'Upload failed. Please try again.';
	} finally {
		avatarUploading = false;
		if (fileInput) fileInput.value = '';
	}
}

async function handleAvatarRemove() {
	avatarError = '';
	avatarUploading = true;

	try {
		const res = await fetch('?/removeAvatar', { method: 'POST' });
		const result = await res.json();

		if (result.type !== 'failure') {
			avatarUrl = null;
		}
	} catch {
		avatarError = 'Failed to remove avatar.';
	} finally {
		avatarUploading = false;
	}
}
</script>

<svelte:head>
	<title>Settings - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title="Saved">
			{#snippet children()}
				<p>{$formMessage}</p>
			{/snippet}
		</Alert>
	{/if}

	<!-- Avatar section (separate from main form) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Avatar</h2>
		{/snippet}

		{#snippet children()}
			<Cluster gap="4" align="center">
				<Avatar src={avatarUrl} alt="Your avatar" fallback={$form.displayName || '?'} size="lg" />
				<Stack gap="2">
					<Cluster gap="2">
						<Button
							variant="outline"
							size="sm"
							disabled={avatarUploading}
							onclick={() => fileInput?.click()}
						>
							{#if avatarUploading}<Spinner size="sm" class="mr-2" />{/if}
							Change photo
						</Button>
						{#if avatarUrl}
							<Button
								variant="ghost"
								size="sm"
								disabled={avatarUploading}
								onclick={handleAvatarRemove}
							>
								Remove
							</Button>
						{/if}
					</Cluster>
					{#if avatarError}
						<p class="text-fluid-xs text-error" role="alert">{avatarError}</p>
					{/if}
				</Stack>
			</Cluster>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp"
				class="hidden"
				onchange={handleAvatarUpload}
			/>
		{/snippet}
	</Card>

	<!-- Main settings form -->
	<form method="POST" use:enhance>
		<Stack gap="6">
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Profile</h2>
				{/snippet}

				{#snippet children()}
					<div class="form-grid">
						<FormField label="Display Name" error={$errors.displayName?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="displayName"
									bind:value={$form.displayName}
									error={!!$errors.displayName}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>
					</div>
				{/snippet}
			</Card>

			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Appearance</h2>
				{/snippet}

				{#snippet children()}
					<Stack gap="4">
						<FormField label="Theme">
							{#snippet children(_)}
								<input type="hidden" name="theme" value={$form.theme} />
								<ToggleGroup items={themeItems} bind:value={$form.theme} />
							{/snippet}
						</FormField>

						<FormField label="Display Density">
							{#snippet children(_)}
								<input type="hidden" name="displayDensity" value={$form.displayDensity} />
								<ToggleGroup items={densityItems} bind:value={$form.displayDensity} />
							{/snippet}
						</FormField>

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-fluid-sm font-medium text-fg">Sidebar Width</span>
								<span class="text-fluid-xs text-muted">{currentWidthLabel}</span>
							</div>
							<input type="hidden" name="sidebarWidth" value={$form.sidebarWidth} />
							<Slider bind:value={sliderValue} min={160} max={320} step={40} />
						</div>
					</Stack>
				{/snippet}
			</Card>

			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Locale</h2>
				{/snippet}

				{#snippet children()}
					<div class="form-grid">
						<FormField label="Language" error={$errors.locale?.[0]}>
							{#snippet children(_)}
								<input type="hidden" name="locale" value={$form.locale} />
								<Select options={localeOptions} bind:value={$form.locale} error={!!$errors.locale} />
							{/snippet}
						</FormField>

						<FormField label="Timezone" error={$errors.timezone?.[0]}>
							{#snippet children(_)}
								<input type="hidden" name="timezone" value={$form.timezone} />
								<Select options={timezoneOptions} bind:value={$form.timezone} error={!!$errors.timezone} />
							{/snippet}
						</FormField>

						<FormField label="Date Format" error={$errors.dateFormat?.[0]}>
							{#snippet children(_)}
								<input type="hidden" name="dateFormat" value={$form.dateFormat} />
								<Select options={dateFormatOptions} bind:value={$form.dateFormat} error={!!$errors.dateFormat} />
							{/snippet}
						</FormField>
					</div>
				{/snippet}
			</Card>

			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Accessibility</h2>
				{/snippet}

				{#snippet children()}
					<Stack gap="4">
						<FormField label="Reduce Motion" description="Minimize animations and transitions">
							{#snippet children(_)}
								<input type="hidden" name="reduceMotion" value={$form.reduceMotion ? 'on' : ''} />
								<Switch bind:checked={$form.reduceMotion} label={$form.reduceMotion ? 'On' : 'Off'} />
							{/snippet}
						</FormField>

						<FormField label="High Contrast" description="Increase contrast for better readability">
							{#snippet children(_)}
								<input type="hidden" name="highContrast" value={$form.highContrast ? 'on' : ''} />
								<Switch bind:checked={$form.highContrast} label={$form.highContrast ? 'On' : 'Off'} />
							{/snippet}
						</FormField>
					</Stack>
				{/snippet}
			</Card>

			<Cluster justify="end">
				<Button type="submit" disabled={$submitting || !$tainted}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{$tainted ? 'Save Changes' : 'No Changes'}
				</Button>
			</Cluster>
		</Stack>
	</form>
</Stack>
