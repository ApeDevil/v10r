<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Avatar, Button, Input, Select, Slider, Spinner, Switch, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { userSettingsSchema } from '$lib/schemas/app/settings';
import { getSidebar } from '$lib/state/sidebar.svelte';

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

const widthLabels: Record<number, () => string> = {
	160: m.app_settings_appearance_sidebar_narrow,
	200: m.app_settings_appearance_sidebar_compact,
	240: m.app_settings_appearance_sidebar_default,
	280: m.app_settings_appearance_sidebar_comfortable,
	320: m.app_settings_appearance_sidebar_wide,
};

const currentWidthLabel = $derived(widthLabels[sliderValue[0]]?.() ?? `${sliderValue[0]}px`);

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

const themeItems = $derived([
	{ value: 'light', label: m.app_settings_appearance_theme_light() },
	{ value: 'system', label: m.app_settings_appearance_theme_system() },
	{ value: 'dark', label: m.app_settings_appearance_theme_dark() },
]);

const densityItems = $derived([
	{ value: 'compact', label: m.app_settings_appearance_density_compact() },
	{ value: 'comfortable', label: m.app_settings_appearance_density_comfortable() },
	{ value: 'spacious', label: m.app_settings_appearance_density_spacious() },
]);

const localeOptions = $derived([
	{ value: 'en', label: m.app_settings_locale_lang_en() },
	{ value: 'es', label: m.app_settings_locale_lang_es() },
	{ value: 'fr', label: m.app_settings_locale_lang_fr() },
	{ value: 'de', label: m.app_settings_locale_lang_de() },
	{ value: 'ja', label: m.app_settings_locale_lang_ja() },
]);

const timezoneOptions = $derived([
	{ value: 'UTC', label: 'UTC' },
	{ value: 'America/New_York', label: m.app_settings_locale_tz_eastern() },
	{ value: 'America/Chicago', label: m.app_settings_locale_tz_central() },
	{ value: 'America/Denver', label: m.app_settings_locale_tz_mountain() },
	{ value: 'America/Los_Angeles', label: m.app_settings_locale_tz_pacific() },
	{ value: 'Europe/London', label: 'London' },
	{ value: 'Europe/Berlin', label: 'Berlin' },
	{ value: 'Europe/Paris', label: 'Paris' },
	{ value: 'Asia/Tokyo', label: 'Tokyo' },
	{ value: 'Asia/Shanghai', label: 'Shanghai' },
	{ value: 'Australia/Sydney', label: 'Sydney' },
]);

const dateFormatOptions = $derived([
	{ value: 'relative', label: m.app_settings_locale_date_relative() },
	{ value: 'absolute', label: m.app_settings_locale_date_absolute() },
	{ value: 'iso', label: m.app_settings_locale_date_iso() },
]);

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
			avatarError = result.data?.avatarError ?? m.app_settings_avatar_upload_failed();
		} else {
			avatarUrl = result.data?.avatarUrl ?? avatarUrl;
		}
	} catch {
		avatarError = m.app_settings_avatar_upload_failed_retry();
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
		avatarError = m.app_settings_avatar_remove_failed();
	} finally {
		avatarUploading = false;
	}
}
</script>
<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title={m.app_settings_alert_saved()}>
			{#snippet children()}
				<p>{$formMessage}</p>
			{/snippet}
		</Alert>
	{/if}

	<!-- Avatar section (separate from main form) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_settings_avatar_heading()}</h2>
		{/snippet}

		{#snippet children()}
			<Cluster gap="4" align="center">
				<Avatar src={avatarUrl} alt={m.app_settings_avatar_alt()} fallback={$form.displayName || '?'} size="lg" />
				<Stack gap="2">
					<Cluster gap="2">
						<Button
							variant="outline"
							size="sm"
							disabled={avatarUploading}
							onclick={() => fileInput?.click()}
						>
							{#if avatarUploading}<Spinner size="sm" class="mr-2" />{/if}
							{m.app_settings_avatar_change()}
						</Button>
						{#if avatarUrl}
							<Button
								variant="ghost"
								size="sm"
								disabled={avatarUploading}
								onclick={handleAvatarRemove}
							>
								{m.app_settings_avatar_remove()}
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
					<h2 class="text-fluid-lg font-semibold">{m.app_settings_profile_heading()}</h2>
				{/snippet}

				{#snippet children()}
					<div class="form-grid">
						<FormField label={m.app_settings_profile_display_name()} error={$errors.displayName?.[0]} required>
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
					<h2 class="text-fluid-lg font-semibold">{m.app_settings_appearance_heading()}</h2>
				{/snippet}

				{#snippet children()}
					<Stack gap="4">
						<FormField label={m.app_settings_appearance_theme()}>
							{#snippet children(_)}
								<input type="hidden" name="theme" value={$form.theme} />
								<ToggleGroup items={themeItems} bind:value={$form.theme} />
							{/snippet}
						</FormField>

						<FormField label={m.app_settings_appearance_density()}>
							{#snippet children(_)}
								<input type="hidden" name="displayDensity" value={$form.displayDensity} />
								<ToggleGroup items={densityItems} bind:value={$form.displayDensity} />
							{/snippet}
						</FormField>

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-fluid-sm font-medium text-fg">{m.app_settings_appearance_sidebar_width()}</span>
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
					<h2 class="text-fluid-lg font-semibold">{m.app_settings_locale_heading()}</h2>
				{/snippet}

				{#snippet children()}
					<div class="form-grid">
						<FormField label={m.app_settings_locale_language()} error={$errors.locale?.[0]}>
							{#snippet children(_)}
								<input type="hidden" name="locale" value={$form.locale} />
								<Select options={localeOptions} bind:value={$form.locale} error={!!$errors.locale} />
							{/snippet}
						</FormField>

						<FormField label={m.app_settings_locale_timezone()} error={$errors.timezone?.[0]}>
							{#snippet children(_)}
								<input type="hidden" name="timezone" value={$form.timezone} />
								<Select options={timezoneOptions} bind:value={$form.timezone} error={!!$errors.timezone} />
							{/snippet}
						</FormField>

						<FormField label={m.app_settings_locale_date_format()} error={$errors.dateFormat?.[0]}>
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
					<h2 class="text-fluid-lg font-semibold">{m.app_settings_a11y_heading()}</h2>
				{/snippet}

				{#snippet children()}
					<Stack gap="4">
						<FormField label={m.app_settings_a11y_reduce_motion()} description={m.app_settings_a11y_reduce_motion_description()}>
							{#snippet children(_)}
								<input type="hidden" name="reduceMotion" value={$form.reduceMotion ? 'on' : ''} />
								<Switch bind:checked={$form.reduceMotion} label={$form.reduceMotion ? m.app_settings_toggle_on() : m.app_settings_toggle_off()} />
							{/snippet}
						</FormField>

						<FormField label={m.app_settings_a11y_high_contrast()} description={m.app_settings_a11y_high_contrast_description()}>
							{#snippet children(_)}
								<input type="hidden" name="highContrast" value={$form.highContrast ? 'on' : ''} />
								<Switch bind:checked={$form.highContrast} label={$form.highContrast ? m.app_settings_toggle_on() : m.app_settings_toggle_off()} />
							{/snippet}
						</FormField>
					</Stack>
				{/snippet}
			</Card>

			<Cluster justify="end">
				<Button type="submit" disabled={$submitting || !$tainted}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{$tainted ? m.app_settings_save() : m.app_settings_no_changes()}
				</Button>
			</Cluster>
		</Stack>
	</form>
</Stack>
