<script lang="ts">
/**
 * Public style picker — choose palette, typography and shape one at a time.
 *
 * The sidebar dice rolls all three at once; this picks them individually. Both
 * write the visitor's own `v10r_style` cookie, so this works signed out.
 *
 * Cards are raw <button>s rather than a project primitive: the component-first
 * rule exempts custom interactive regions like palette swatch cards, and no
 * primitive renders a swatch row.
 */

import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getStyle } from '$lib/state/style.svelte';
import { getToast } from '$lib/state/toast.svelte';
import type { Palette } from '$lib/styles/random';
import { PALETTE_REGISTRY, RADIUS_REGISTRY, TYPOGRAPHY_REGISTRY } from '$lib/styles/random';
import type { OwnedPalette } from './types';

interface Props {
	/** The signed-in visitor's saved palettes. Empty for guests. */
	customPalettes?: OwnedPalette[];
	oncustomize?: () => void;
	onedit?: (palette: OwnedPalette) => void;
	ondelete?: (palette: OwnedPalette) => void;
}

let { customPalettes = [], oncustomize, onedit, ondelete }: Props = $props();

const style = getStyle();
const toast = getToast();

/**
 * Shape labels come from messages, not RADIUS_REGISTRY[].name — the registry
 * names are English-only, and DE/RU translations for these three already ship.
 * The registry name is still what gets stored, so it matches the server echo.
 */
const shapeLabels: Record<string, () => string> = {
	R1: m.showcase_shell_style_shape_sharp,
	R2: m.showcase_shell_style_shape_smooth,
	R3: m.showcase_shell_style_shape_round,
};

/** Five representative tokens per palette — enough to read it at a glance. */
function swatches(p: Palette): string[] {
	return [p.light.primary, p.light.bg, p.light.fg, p.light.muted, p.light.accent ?? p.light['primary-dim']];
}

async function pickPalette(id: string, name: string) {
	await style.pick({ paletteId: id, paletteName: name }, toast);

	// A custom palette's CSS lives in a style element that only a full document
	// render injects (see the i18n hook) — client-side there is no rule for
	// [data-palette="CP_…"] and the page would fall back to the :root defaults.
	// The endpoint already wrote the cookie, so a reload renders it properly,
	// in both light and dark, with no second implementation of the block.
	if (id.startsWith('CP_')) location.reload();
}
</script>

<div class="picker">
	<section class="group">
		<h3 class="group-title">{m.showcase_shell_style_registry_palettes()}</h3>
		<div class="card-grid">
			{#each PALETTE_REGISTRY as p (p.id)}
				<button
					type="button"
					class="style-card"
					class:selected={style.paletteId === p.id}
					aria-pressed={style.paletteId === p.id}
					disabled={style.picking}
					onclick={() => pickPalette(p.id, p.name)}
				>
					<span class="swatches" aria-hidden="true">
						{#each swatches(p) as color}
							<span class="swatch" style:background={color}></span>
						{/each}
					</span>
					<span class="card-name">{p.name}</span>
					<span class="card-desc">{p.description}</span>
				</button>
			{/each}
		</div>

		<div class="group-actions">
			<Button type="button" variant="outline" onclick={() => oncustomize?.()}>
				<span class="i-lucide-wand-2 text-icon-sm" aria-hidden="true"></span>
				{m.showcase_shell_style_action_customize()}
			</Button>
		</div>

		{#if customPalettes.length > 0}
			<div class="owned">
				<h4 class="owned-title">{m.showcase_shell_style_my_palettes()}</h4>
				<div class="owned-list">
					{#each customPalettes as cp (cp.id)}
						<div class="owned-row" class:selected={style.paletteId === cp.id}>
							<button
								type="button"
								class="owned-info"
								aria-pressed={style.paletteId === cp.id}
								disabled={style.picking}
								onclick={() => pickPalette(cp.id, cp.name)}
							>
								<span class="card-name">{cp.name}</span>
								{#if cp.description}
									<span class="card-desc">{cp.description}</span>
								{/if}
							</button>
							<div class="owned-actions">
								<Button type="button" variant="outline" size="sm" onclick={() => onedit?.(cp)}>
									{m.admin_action_edit()}
								</Button>
								<Button type="button" variant="ghost" size="sm" onclick={() => ondelete?.(cp)}>
									{m.admin_action_delete()}
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<section class="group">
		<h3 class="group-title">{m.showcase_shell_style_registry_typography()}</h3>
		<div class="card-grid">
			{#each TYPOGRAPHY_REGISTRY as t (t.id)}
				<button
					type="button"
					class="style-card"
					class:selected={style.typographyId === t.id}
					aria-pressed={style.typographyId === t.id}
					disabled={style.picking}
					onclick={() => style.pick({ typographyId: t.id, typographyName: t.name }, toast)}
				>
					<span class="card-name">{t.name}</span>
					<span class="card-desc">{t.description}</span>
				</button>
			{/each}
		</div>
	</section>

	<section class="group">
		<h3 class="group-title">{m.showcase_shell_style_registry_radius()}</h3>
		<div class="card-grid">
			{#each RADIUS_REGISTRY as r (r.id)}
				<button
					type="button"
					class="style-card"
					class:selected={style.radiusId === r.id}
					aria-pressed={style.radiusId === r.id}
					disabled={style.picking}
					onclick={() => style.pick({ radiusId: r.id, radiusName: r.name }, toast)}
				>
					<span class="card-name">{shapeLabels[r.id]?.() ?? r.name}</span>
					<span class="card-desc">{r.description}</span>
				</button>
			{/each}
		</div>
	</section>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.group-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
		margin-bottom: var(--spacing-3);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: var(--spacing-3);
	}

	.style-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		text-align: left;
		cursor: pointer;
		transition: border-color var(--duration-fast), background var(--duration-fast);
	}

	.style-card:hover:not(:disabled) {
		border-color: var(--color-primary-dim);
		background: var(--color-subtle);
	}

	.style-card.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-container);
	}

	.style-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.style-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.swatches {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-1);
	}

	.swatch {
		width: 1rem;
		height: 1rem;
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border);
	}

	.card-name {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}

	.card-desc {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.group-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--spacing-3);
	}

	.owned {
		margin-top: var(--spacing-4);
	}

	.owned-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		margin-bottom: var(--spacing-3);
	}

	.owned-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.owned-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
		padding: var(--spacing-2) var(--spacing-3);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
	}

	.owned-row.selected {
		border-color: var(--color-primary);
		background: var(--color-primary-container);
	}

	.owned-info {
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

	.owned-info:disabled {
		cursor: not-allowed;
	}

	.owned-info:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.owned-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-shrink: 0;
	}

	@media (max-width: 480px) {
		.owned-row {
			flex-direction: column;
			align-items: stretch;
			gap: var(--spacing-2);
		}
	}
</style>
