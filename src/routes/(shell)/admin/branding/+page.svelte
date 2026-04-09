<script lang="ts">
import { get } from 'svelte/store';
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { browser } from '$app/environment';
import { enhance as kitEnhance } from '$app/forms';
import { beforeNavigate, invalidateAll } from '$app/navigation';
import CascadePrompt from '$lib/components/branding/CascadePrompt.svelte';
import CustomPaletteEditor from '$lib/components/branding/CustomPaletteEditor.svelte';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Input, Spinner, Switch, ToggleGroup } from '$lib/components/primitives';
import { brandSettingsSchema } from '$lib/schemas/app/branding';
import { getTheme } from '$lib/state/theme.svelte';
import { getPalette } from '$lib/styles/random/palette-registry';
import type { PaletteColors, PaletteId } from '$lib/styles/random/types';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
const theme = getTheme();

const {
	form,
	enhance,
	submitting,
	delayed,
	tainted,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(brandSettingsSchema),
	resetForm: false,
	onUpdated({ form }) {
		if (form.valid) {
			brandSaved = true;
			invalidateAll();
		}
	},
});

// ── Unsaved changes guard ─────────────────────────────────────────────────────

beforeNavigate(({ cancel }) => {
	if (get(tainted) || editingCustom) {
		if (!confirm('You have unsaved changes. Leave anyway?')) cancel();
	}
});

$effect(() => {
	if (!browser) return;
	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (get(tainted) || editingCustom) {
			event.preventDefault();
		}
	}
	window.addEventListener('beforeunload', handleBeforeUnload);
	return () => window.removeEventListener('beforeunload', handleBeforeUnload);
});

// ── Live preview: sync data-* attributes on <html> as admin picks options ────
// After a successful save, skip cleanup so invalidateAll() style persists on navigation.

let brandSaved = $state(false);

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.palette;
	document.documentElement.dataset.palette = $form.paletteId;
	return () => {
		if (!brandSaved) document.documentElement.dataset.palette = prev ?? '';
	};
});

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.typography;
	document.documentElement.dataset.typography = $form.typographyId;
	return () => {
		if (!brandSaved) document.documentElement.dataset.typography = prev ?? '';
	};
});

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.radius;
	document.documentElement.dataset.radius = $form.radiusId;
	return () => {
		if (!brandSaved) document.documentElement.dataset.radius = prev ?? '';
	};
});

const shapeItems = [
	{ value: 'R1', label: 'Sharp' },
	{ value: 'R2', label: 'Smooth' },
	{ value: 'R3', label: 'Round' },
];

// ── Custom palette editor state ───────────────────────────────────────────────

let editingCustom = $state(false);
let editMode = $state<'light' | 'dark'>('light');
let customName = $state('');
let customDescription = $state('');
let customBasePaletteId = $state('P1');
let customLightColors = $state<PaletteColors | null>(null);
let customDarkColors = $state<PaletteColors | null>(null);
let editingPaletteId = $state<string | null>(null);
let showCascade = $state(false);

/** All 25 token keys — used when removing inline styles on close */
const TOKEN_KEYS: (keyof PaletteColors)[] = [
	'bg',
	'fg',
	'body',
	'heading',
	'muted',
	'border',
	'subtle',
	'primary',
	'primary-hover',
	'primary-container',
	'on-primary-container',
	'primary-dim',
	'on-primary',
	'secondary',
	'on-secondary',
	'accent',
	'accent-hover',
	'on-accent',
	'accent-container',
	'on-accent-container',
	'input',
	'input-border',
	'surface-1',
	'surface-2',
	'surface-3',
];

function tokenToCssVar(key: string): string {
	if (key.startsWith('surface-')) {
		return `--surface-${key.split('-')[1]}`;
	}
	return `--color-${key}`;
}

function clearInlineStyles() {
	if (!browser) return;
	const el = document.documentElement;
	for (const key of TOKEN_KEYS) {
		el.style.removeProperty(tokenToCssVar(key));
	}
}

function startCustomize() {
	const id = $form.paletteId;
	const preset = getPalette(id as PaletteId);
	if (!preset) return;
	customBasePaletteId = id;
	customName = `Custom ${preset.name}`;
	customDescription = '';
	customLightColors = { ...preset.light };
	customDarkColors = { ...preset.dark };
	editingPaletteId = null;
	showCascade = false;
	editMode = theme.resolvedMode;
	editingCustom = true;
}

function editExistingCustom(cp: (typeof data.customPalettes)[number]) {
	customName = cp.name;
	customDescription = cp.description ?? '';
	customBasePaletteId = cp.basePaletteId;
	customLightColors = { ...(cp.lightColors as unknown as PaletteColors) };
	customDarkColors = { ...(cp.darkColors as unknown as PaletteColors) };
	editingPaletteId = cp.id;
	showCascade = false;
	editMode = theme.resolvedMode;
	editingCustom = true;
}

function cancelEdit() {
	clearInlineStyles();
	editingCustom = false;
	showCascade = false;
}

// Live custom palette preview — applies token CSS vars directly to <html>
$effect(() => {
	if (!browser || !editingCustom) return;
	const colors = editMode === 'light' ? customLightColors : customDarkColors;
	if (!colors) return;
	const el = document.documentElement;
	for (const key of TOKEN_KEYS) {
		const val = colors[key];
		if (val) {
			el.style.setProperty(tokenToCssVar(key), val);
		} else {
			el.style.removeProperty(tokenToCssVar(key));
		}
	}
	return () => clearInlineStyles();
});

const editModeItems = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
];
</script>

<svelte:head>
	<title>Visual Identity - Admin - Velociraptor</title>
</svelte:head>

{#snippet saveAction()}
	<div class="save-action">
		<Button type="submit" form="brandForm" disabled={$submitting}>
			{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
			{#if $form.enabled}Save & Lock{:else}Save{/if}
		</Button>
	</div>
{/snippet}

<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title="Saved">
			{#snippet children()}
				<p>{$formMessage}</p>
			{/snippet}
		</Alert>
	{/if}

	<!-- Visual Identity — first, controls whether branding is locked -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Visual Identity</h2>
		{/snippet}

		{#snippet children()}
			<Stack gap="4">
				<FormField
					label="Lock visual identity"
					description="When locked, all visitors see your brand. When unlocked, visitors explore random styles."
				>
					{#snippet children(_)}
						<Switch bind:checked={$form.enabled} label={$form.enabled ? 'Locked' : 'Exploring'} />
					{/snippet}
				</FormField>

				{#if $tainted && !$form.enabled}
					<div class="identity-hint" role="status">
						<p class="text-fluid-xs">
							Visual identity is unlocked — changes will be saved but visitors will still see random styles.
							<button type="button" class="identity-hint-action" onclick={() => ($form.enabled = true)}>
								Lock visual identity
							</button>
						</p>
					</div>
				{/if}

				{#if $tainted?.enabled}
					{@render saveAction()}
				{/if}
			</Stack>
		{/snippet}
	</Card>

	<!-- Palette -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Palette</h2>
		{/snippet}

		{#snippet children()}
			<Stack gap="5">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each data.palettes as palette}
						<button
							type="button"
							class="palette-card"
							class:selected={$form.paletteId === palette.id}
							aria-pressed={$form.paletteId === palette.id}
							onclick={() => ($form.paletteId = palette.id)}
						>
							<div class="flex items-center gap-2">
								{#each Object.values(palette.swatches) as color}
									<span
										class="inline-block h-4 w-4 rounded-full border border-border"
										style:background={color}
									></span>
								{/each}
							</div>
							<p class="mt-2 text-fluid-sm font-medium text-fg">{palette.name}</p>
							<p class="text-fluid-xs text-muted">{palette.description}</p>
						</button>
					{/each}
				</div>

				{#if !$form.paletteId.startsWith('CP_')}
					<Cluster justify="end">
						<Button type="button" variant="outline" onclick={startCustomize}>
							<span class="i-lucide-wand-2 mr-1 inline-block" aria-hidden="true"></span>
							Customize
						</Button>
					</Cluster>
				{/if}

				{#if data.customPalettes.length > 0}
					<div>
						<h3 class="text-fluid-sm font-semibold mb-3">My Custom Palettes</h3>
						<div class="flex flex-col gap-2">
							{#each data.customPalettes as cp}
								<div class="custom-palette-row" class:selected={$form.paletteId === cp.id}>
									<button
										type="button"
										class="custom-palette-info"
										aria-pressed={$form.paletteId === cp.id}
										onclick={() => ($form.paletteId = cp.id)}
									>
										<span class="text-fluid-sm font-medium text-fg">{cp.name}</span>
										{#if cp.description}
											<span class="text-fluid-xs text-muted">{cp.description}</span>
										{/if}
									</button>
									<div class="flex items-center gap-2">
										<Button type="button" variant="outline" size="sm" onclick={() => editExistingCustom(cp)}>
											Edit
										</Button>
										<form method="POST" action="?/deleteCustomPalette" use:kitEnhance={({ cancel }) => {
											if (!confirm('Delete this palette?')) { cancel(); return; }
											return async ({ update }) => { await update(); };
										}}>
											<input type="hidden" name="paletteId" value={cp.id} />
											<Button type="submit" variant="ghost" size="sm">Delete</Button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if editingCustom && customLightColors && customDarkColors}
					<div class="editor-section">
						<div class="flex items-center justify-between gap-3 mb-4">
							<h3 class="text-fluid-sm font-semibold">Custom Palette Editor</h3>
							<div class="flex items-center gap-3">
								<ToggleGroup items={editModeItems} bind:value={editMode} />
								<Button type="button" variant="ghost" onclick={cancelEdit}>Cancel</Button>
							</div>
						</div>

						<Stack gap="4">
							<div class="flex gap-3">
								<Input
									class="flex-1"
									bind:value={customName}
									placeholder="Palette name"
									required
								/>
								<Input
									class="flex-1"
									bind:value={customDescription}
									placeholder="Description (optional)"
								/>
							</div>

							<CascadePrompt
								visible={showCascade}
								ondismiss={() => { showCascade = false; }}
							/>

							<CustomPaletteEditor
								palette={editMode === 'light' ? customLightColors : customDarkColors}
								otherMode={editMode === 'light' ? customDarkColors : customLightColors}
								mode={editMode}
								onchange={(token) => {
									if (token === 'primary') showCascade = true;
								}}
							/>

							<Cluster justify="end">
								<form method="POST" action="?/saveCustomPalette" use:kitEnhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'success') {
											clearInlineStyles();
											editingCustom = false;
										}
										await update();
									};
								}}>
									<input type="hidden" name="paletteId" value={editingPaletteId ?? ''} />
									<input
										type="hidden"
										name="paletteData"
										value={JSON.stringify({
											name: customName,
											description: customDescription,
											basePaletteId: customBasePaletteId,
											lightColors: customLightColors,
											darkColors: customDarkColors,
										})}
									/>
									<Button type="submit" disabled={!customName.trim()}>Save Palette</Button>
								</form>
							</Cluster>
						</Stack>
					</div>
				{/if}

				{#if $tainted?.paletteId}
					{@render saveAction()}
				{/if}
			</Stack>
		{/snippet}
	</Card>

	<!-- Main settings form -->
	<form id="brandForm" method="POST" action="?/saveBrandSettings" use:enhance>
		<input type="hidden" name="paletteId" value={$form.paletteId} />
		<input type="hidden" name="enabled" value={$form.enabled ? 'on' : ''} />
		<Stack gap="6">
			<!-- Typography -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Typography</h2>
				{/snippet}

				{#snippet children()}
					<input type="hidden" name="typographyId" value={$form.typographyId} />
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each data.typographySets as typo}
							<button
								type="button"
								class="palette-card"
								class:selected={$form.typographyId === typo.id}
								aria-pressed={$form.typographyId === typo.id}
								onclick={() => ($form.typographyId = typo.id)}
							>
								<p class="text-fluid-sm font-medium text-fg">{typo.name}</p>
								<p class="text-fluid-xs text-muted">{typo.description}</p>
							</button>
						{/each}
					</div>

					{#if $tainted?.typographyId}
						{@render saveAction()}
					{/if}
				{/snippet}
			</Card>

			<!-- Shape -->
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Shape</h2>
				{/snippet}

				{#snippet children()}
					<input type="hidden" name="radiusId" value={$form.radiusId} />
					<ToggleGroup items={shapeItems} bind:value={$form.radiusId} />

					{#if $tainted?.radiusId}
						{@render saveAction()}
					{/if}
				{/snippet}
			</Card>

		</Stack>
	</form>
</Stack>

<style>
	.palette-card {
		padding: 1rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-1);
		text-align: left;
		cursor: pointer;
	}

	.palette-card:hover {
		border-color: var(--color-primary-dim);
		background: var(--color-subtle);
	}

	.palette-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-container);
	}

	.custom-palette-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.75rem;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-border);
		background: var(--color-surface-1);
		cursor: pointer;
	}

	.custom-palette-row:hover {
		border-color: var(--color-primary-dim);
		background: var(--color-subtle);
	}

	.custom-palette-row.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-container);
	}

	.editor-section {
		border-top: 1px solid var(--color-border);
		padding-top: 1.25rem;
	}

	.custom-palette-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}

	.identity-hint {
		padding: 0.625rem 1rem;
		border-left: 3px solid var(--color-warning-fg, oklch(0.75 0.15 85));
		border-radius: var(--radius-sm);
		background: var(--color-warning-bg, oklch(0.95 0.05 85));
		color: var(--color-fg);
	}

	:global(.dark) .identity-hint {
		background: var(--color-warning-bg, oklch(0.25 0.05 85));
	}

	.identity-hint-action {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-warning-fg, oklch(0.75 0.15 85));
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.identity-hint-action:hover {
		opacity: 0.8;
	}

	.save-action {
		display: flex;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}
</style>
