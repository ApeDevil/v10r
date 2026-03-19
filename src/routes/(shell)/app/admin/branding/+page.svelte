<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { browser } from '$app/environment';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Spinner, Switch, ToggleGroup } from '$lib/components/primitives';
import { brandSettingsSchema } from '$lib/schemas/app/branding';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

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

// Live preview: sync data-* attributes on <html> as admin picks options
$effect(() => {
	if (!browser) return;
	document.documentElement.dataset.palette = $form.paletteId;
});

$effect(() => {
	if (!browser) return;
	document.documentElement.dataset.typography = $form.typographyId;
});

$effect(() => {
	if (!browser) return;
	document.documentElement.dataset.radius = $form.radiusId;
});

const shapeItems = [
	{ value: 'R1', label: 'Sharp' },
	{ value: 'R2', label: 'Smooth' },
	{ value: 'R3', label: 'Round' },
];
</script>

<svelte:head>
	<title>Branding - Admin - Velociraptor</title>
</svelte:head>

<form method="POST" use:enhance>
	<Stack gap="6">
		{#if $formMessage}
			<Alert variant="success" title="Saved">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<!-- Palette -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Palette</h2>
			{/snippet}

			{#snippet children()}
				<input type="hidden" name="paletteId" value={$form.paletteId} />
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each data.palettes as palette}
						<button
							type="button"
							class="palette-card"
							class:selected={$form.paletteId === palette.id}
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
			{/snippet}
		</Card>

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

		<!-- Corporate Mode -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Corporate Mode</h2>
			{/snippet}

			{#snippet children()}
				<FormField
					label="Enable corporate mode"
					description="All visitors see this design by default. When off, visitors see random styles (demo mode)."
				>
					{#snippet children(_)}
						<input type="hidden" name="enabled" value={$form.enabled ? 'on' : ''} />
						<Switch bind:checked={$form.enabled} label={$form.enabled ? 'On' : 'Off'} />
						{#if $form.enabled}
							<p class="text-fluid-xs text-muted mt-2">Visitors will no longer see the style randomizer or dice button.</p>
						{/if}
					{/snippet}
				</FormField>
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
		border-color: var(--color-primary-light);
		background: var(--color-subtle);
	}

	.palette-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-bg);
	}
</style>
