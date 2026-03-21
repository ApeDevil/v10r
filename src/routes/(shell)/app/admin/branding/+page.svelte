<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { enhance as kitEnhance } from '$app/forms';
import { browser } from '$app/environment';
import { beforeNavigate } from '$app/navigation';
import { get } from 'svelte/store';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Spinner, Switch, ToggleGroup } from '$lib/components/primitives';
import CascadePrompt from '$lib/components/branding/CascadePrompt.svelte';
import CustomPaletteEditor from '$lib/components/branding/CustomPaletteEditor.svelte';
import { brandSettingsSchema } from '$lib/schemas/app/branding';
import { getPalette } from '$lib/styles/random/palette-registry';
import { getTheme } from '$lib/state/theme.svelte';
import type { PaletteColors } from '$lib/styles/random/types';
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

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.palette;
	document.documentElement.dataset.palette = $form.paletteId;
	return () => { document.documentElement.dataset.palette = prev ?? ''; };
});

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.typography;
	document.documentElement.dataset.typography = $form.typographyId;
	return () => { document.documentElement.dataset.typography = prev ?? ''; };
});

$effect(() => {
	if (!browser) return;
	const prev = document.documentElement.dataset.radius;
	document.documentElement.dataset.radius = $form.radiusId;
	return () => { document.documentElement.dataset.radius = prev ?? ''; };
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

/** All 20 token keys — used when removing inline styles on close */
const TOKEN_KEYS: (keyof PaletteColors)[] = [
	'bg', 'fg', 'body', 'heading', 'muted', 'border', 'subtle',
	'primary', 'primary-hover', 'primary-container', 'on-primary-container',
	'primary-dim', 'on-primary', 'secondary', 'on-secondary',
	'input', 'input-border', 'surface-1', 'surface-2', 'surface-3',
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
	const preset = getPalette(id as any);
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

function editExistingCustom(cp: typeof data.customPalettes[number]) {
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
		el.style.setProperty(tokenToCssVar(key), colors[key]);
	}
	return () => clearInlineStyles();
});

const editModeItems = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
];
</script>

<svelte:head>
	<title>Branding - Admin - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title="Saved">
			{#snippet children()}
				<p>{$formMessage}</p>
			{/snippet}
		</Alert>
	{/if}

	<!-- Corporate Mode — first, controls whether branding is applied -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Corporate Mode</h2>
		{/snippet}

		{#snippet children()}
			<FormField
				label="Enable corporate mode"
				description="When on, all visitors see this design. When off, visitors see random styles (demo mode)."
			>
				{#snippet children(_)}
					<Switch bind:checked={$form.enabled} label={$form.enabled ? 'On' : 'Off'} />
				{/snippet}
			</FormField>
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
								<input
									class="flex-1 rounded-md border border-input-border px-3 py-2 text-fluid-sm"
									style="background: var(--color-input); color: var(--color-fg);"
									bind:value={customName}
									placeholder="Palette name"
									required
								/>
								<input
									class="flex-1 rounded-md border border-input-border px-3 py-2 text-fluid-sm"
									style="background: var(--color-input); color: var(--color-fg);"
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
			</Stack>
		{/snippet}
	</Card>

	<!-- Main settings form -->
	<form method="POST" action="?/saveBrandSettings" use:enhance>
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
				{/snippet}
			</Card>

			<!-- Corporate mode warning -->
			{#if $tainted && !$form.enabled}
				<div class="corporate-hint" role="status">
					<p class="text-fluid-xs">
						Corporate mode is off — these changes will be saved but visitors will still see random styles.
						<button type="button" class="corporate-hint-action" onclick={() => ($form.enabled = true)}>
							Turn on corporate mode
						</button>
					</p>
				</div>
			{/if}

			<!-- Save -->
			<Cluster justify="end">
				<Button type="submit" disabled={$submitting || !$tainted}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{#if !$tainted}
						No Changes
					{:else if $form.enabled}
						Save and Apply to All Visitors
					{:else}
						Save Changes
					{/if}
				</Button>
			</Cluster>
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

	.corporate-hint {
		padding: 0.625rem 1rem;
		border-left: 3px solid var(--color-warning-fg, oklch(0.75 0.15 85));
		border-radius: var(--radius-sm);
		background: var(--color-warning-bg, oklch(0.95 0.05 85));
		color: var(--color-fg);
	}

	:global(.dark) .corporate-hint {
		background: var(--color-warning-bg, oklch(0.25 0.05 85));
	}

	.corporate-hint-action {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-warning-fg, oklch(0.75 0.15 85));
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.corporate-hint-action:hover {
		opacity: 0.8;
	}
</style>
