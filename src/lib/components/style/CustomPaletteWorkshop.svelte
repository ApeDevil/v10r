<script lang="ts">
/**
 * Craft a custom palette — 25 OKLCH tokens with a live preview.
 *
 * Open to everyone. Crafting and previewing are entirely client-side, so a
 * logged-out visitor gets the full editor; only persisting needs an account,
 * which is what `canSave` gates.
 */

import { browser } from '$app/environment';
import { beforeNavigate } from '$app/navigation';
import { apiFetch } from '$lib/api';
import { Alert } from '$lib/components/composites';
import { Button, Input, Spinner, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getTheme } from '$lib/state/theme.svelte';
import { getPalette } from '$lib/styles/random';
import { applyPalettePreview, clearPalettePreview } from '$lib/styles/random/token-vars';
import type { PaletteColors, PaletteId } from '$lib/styles/random/types';
import CascadePrompt from './CascadePrompt.svelte';
import CustomPaletteEditor from './CustomPaletteEditor.svelte';
import type { OwnedPalette } from './types';

interface Props {
	/** Preset to seed a brand-new palette from. Ignored when `existing` is set. */
	basePaletteId: string;
	/** Editing an already-saved palette, rather than crafting a new one. */
	existing?: OwnedPalette | null;
	/** False for guests — crafting still works, saving does not. */
	canSave: boolean;
	onclose: () => void;
	onsaved: (palette: OwnedPalette) => void;
}

let { basePaletteId, existing = null, canSave, onclose, onsaved }: Props = $props();

const theme = getTheme();

const seed = existing
	? {
			name: existing.name,
			description: existing.description ?? '',
			base: existing.basePaletteId,
			light: { ...(existing.lightColors as PaletteColors) },
			dark: { ...(existing.darkColors as PaletteColors) },
		}
	: (() => {
			const preset = getPalette(basePaletteId as PaletteId);
			return {
				name: preset ? `Custom ${preset.name}` : 'Custom palette',
				description: '',
				base: basePaletteId,
				light: preset ? { ...preset.light } : null,
				dark: preset ? { ...preset.dark } : null,
			};
		})();

let name = $state(seed.name);
let description = $state(seed.description);
let lightColors = $state<PaletteColors | null>(seed.light);
let darkColors = $state<PaletteColors | null>(seed.dark);
// svelte-ignore state_referenced_locally
let editMode = $state<'light' | 'dark'>(theme.resolvedMode);
let showCascade = $state(false);
let saving = $state(false);
let saveError = $state('');
/** Only warn about losing work once there is work to lose. */
let dirty = $state(false);

const editModeItems = $derived([
	{ value: 'light', label: m.shell_theme_light() },
	{ value: 'dark', label: m.shell_theme_dark() },
]);

// The one preview effect. Writes only inline custom properties on <html> —
// never data-palette, which state/style.svelte.ts owns exclusively. Cleanup is
// unconditional: closing the workshop always restores what was there before.
$effect(() => {
	const colors = editMode === 'light' ? lightColors : darkColors;
	if (!colors) return;
	applyPalettePreview(colors as unknown as Record<string, string>);
	return () => clearPalettePreview();
});

beforeNavigate(({ cancel }) => {
	if (dirty && !confirm(m.showcase_shell_style_unsaved_confirm())) cancel();
});

$effect(() => {
	if (!browser || !dirty) return;
	function onBeforeUnload(event: BeforeUnloadEvent) {
		event.preventDefault();
	}
	window.addEventListener('beforeunload', onBeforeUnload);
	return () => window.removeEventListener('beforeunload', onBeforeUnload);
});

async function save() {
	if (!canSave || saving || !lightColors || !darkColors) return;
	saving = true;
	saveError = '';

	try {
		const body = JSON.stringify({
			name,
			description,
			basePaletteId: seed.base,
			lightColors,
			darkColors,
		});
		const res = existing
			? await apiFetch(`/api/style/palettes/${existing.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body,
				})
			: await apiFetch('/api/style/palettes', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
				});

		if (!res.ok) {
			const payload = await res.json().catch(() => null);
			saveError = payload?.error?.message ?? 'Could not save this palette.';
			return;
		}

		const { data } = await res.json();
		onsaved(data.palette);
	} catch {
		saveError = 'Could not save this palette.';
	} finally {
		saving = false;
	}
}
</script>

<div class="workshop">
	<div class="workshop-head">
		<h4 class="workshop-title">{m.showcase_shell_style_palette_editor()}</h4>
		<div class="workshop-controls">
			<ToggleGroup items={editModeItems} bind:value={editMode} />
			<Button type="button" variant="ghost" onclick={onclose}>{m.admin_action_cancel()}</Button>
		</div>
	</div>

	{#if lightColors && darkColors}
		<div class="workshop-body">
			<div class="meta-row">
				<Input
					class="flex-1"
					bind:value={name}
					oninput={() => (dirty = true)}
					placeholder={m.showcase_shell_style_palette_name_placeholder()}
					required
				/>
				<Input
					class="flex-1"
					bind:value={description}
					oninput={() => (dirty = true)}
					placeholder={m.showcase_shell_style_palette_desc_placeholder()}
				/>
			</div>

			<CascadePrompt visible={showCascade} ondismiss={() => (showCascade = false)} />

			<CustomPaletteEditor
				palette={editMode === 'light' ? lightColors : darkColors}
				onchange={(token) => {
					dirty = true;
					if (token === 'primary') showCascade = true;
				}}
			/>

			{#if saveError}
				<Alert variant="error" title={saveError} />
			{/if}

			{#if canSave}
				<div class="workshop-actions">
					<Button type="button" disabled={!name.trim() || saving} onclick={save}>
						{#if saving}<Spinner size="sm" class="mr-2" />{/if}
						{m.showcase_shell_style_action_save_palette()}
					</Button>
				</div>
			{:else}
				<Alert variant="info" title={m.showcase_shell_style_signin_to_save()}>
					{#snippet children()}
						<p>
							<a class="signin-link" href="/auth/login?returnTo=/showcases/shell/style">
								{m.showcase_shell_style_action_signin()}
							</a>
						</p>
					{/snippet}
				</Alert>
			{/if}
		</div>
	{/if}
</div>

<style>
	.workshop {
		border-top: 1px solid var(--color-border);
		padding-top: var(--spacing-5);
		margin-top: var(--spacing-5);
	}

	.workshop-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		margin-bottom: var(--spacing-4);
	}

	.workshop-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.workshop-controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.workshop-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.meta-row {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.workshop-actions {
		display: flex;
		justify-content: flex-end;
	}

	.signin-link {
		color: var(--color-primary);
		font-weight: 500;
	}
</style>
