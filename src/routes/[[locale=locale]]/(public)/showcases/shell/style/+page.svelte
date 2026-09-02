<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { apiFetch } from '$lib/api';
import { ConfirmDialog, NavSection } from '$lib/components/composites';
import { Button } from '$lib/components/primitives';
import { CustomPaletteWorkshop, type OwnedPalette, StylePicker } from '$lib/components/style';
import * as m from '$lib/paraglide/messages';
import { getStyle } from '$lib/state/style.svelte';
import { getTheme } from '$lib/state/theme.svelte';
import { getToast } from '$lib/state/toast.svelte';
import { PALETTE_REGISTRY, RADIUS_REGISTRY, TYPOGRAPHY_REGISTRY } from '$lib/styles/random';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const theme = getTheme();
const style = getStyle();
const toast = getToast();

const totalCombinations = PALETTE_REGISTRY.length * TYPOGRAPHY_REGISTRY.length * RADIUS_REGISTRY.length;
const signedIn = $derived(Boolean(data.session));

// Workshop orchestration. `workshopKey` forces a remount when switching between
// crafting a new palette and editing a saved one, so the editor re-seeds.
let workshopOpen = $state(false);
let editing = $state<OwnedPalette | null>(null);
let workshopKey = $state(0);
let pendingDelete = $state<OwnedPalette | null>(null);

function openWorkshop(palette: OwnedPalette | null) {
	editing = palette;
	workshopKey++;
	workshopOpen = true;
}

async function confirmDelete() {
	const target = pendingDelete;
	pendingDelete = null;
	if (!target) return;

	const res = await apiFetch(`/api/style/palettes/${target.id}`, { method: 'DELETE' });
	if (!res.ok) {
		toast.info('Could not delete that palette', 4000);
		return;
	}
	// The deleted palette may be the one currently applied; a full reload lets the
	// server fall back and re-render cleanly.
	if (style.paletteId === target.id) {
		location.reload();
		return;
	}
	await invalidateAll();
}

const sections = $derived([
	{ id: 'shell-style-theme', label: m.showcase_shell_style_section_theme() },
	{ id: 'shell-style-randomizer', label: m.showcase_shell_style_section_randomizer() },
	{ id: 'shell-style-picker', label: m.showcase_shell_style_section_picker() },
]);
</script>
<NavSection {sections} />

<!-- Section 1: Theme -->
<section class="demo-section" id="shell-style-theme">
	<h2>{m.showcase_shell_style_section_theme()}</h2>
	<p>Dark or light — your eyes decide.</p>

	<dl class="state-list">
		<dt>Mode:</dt>
		<dd>{theme.mode}</dd>

		<dt>Resolved:</dt>
		<dd>{theme.resolvedMode}</dd>

		<dt>Is Dark:</dt>
		<dd>{theme.isDark ? 'Yes' : 'No'}</dd>
	</dl>

	<div class="button-group">
		<Button variant="secondary" onclick={() => theme.setMode('light')}>{m.showcase_shell_style_btn_light()}</Button>
		<Button variant="secondary" onclick={() => theme.setMode('dark')}>{m.showcase_shell_style_btn_dark()}</Button>
		<Button variant="secondary" onclick={() => theme.setMode('system')}>{m.showcase_shell_style_btn_system()}</Button>
	</div>
</section>

<!-- Section 2: Style Randomizer — the automatic path -->
<section class="demo-section" id="shell-style-randomizer">
	<h2>{m.showcase_shell_style_section_randomizer()}</h2>
	<p>
		{PALETTE_REGISTRY.length} palettes &times; {TYPOGRAPHY_REGISTRY.length} typography sets &times;
		{RADIUS_REGISTRY.length} radius presets = <strong>{totalCombinations} combinations</strong>.
		Roll for a whole look at once, or pick each piece yourself below.
	</p>

	<dl class="state-list">
		<dt>Palette:</dt>
		<dd>{style.paletteName} <span class="id-badge">{style.paletteId}</span></dd>

		<dt>Typography:</dt>
		<dd>{style.typographyName} <span class="id-badge">{style.typographyId}</span></dd>

		<dt>Radius:</dt>
		<dd>{style.radiusName} <span class="id-badge">{style.radiusId}</span></dd>

		<dt>Rolls:</dt>
		<dd>{style.rollCount}</dd>
	</dl>

	<div class="button-group">
		<Button variant="secondary" onclick={() => style.roll(toast)} disabled={style.rolling}>
			{#if style.rolling}
				{m.showcase_shell_style_btn_rolling()}
			{:else}
				{m.showcase_shell_style_btn_roll()}
			{/if}
		</Button>
		<Button variant="secondary" onclick={() => style.roll(toast)} disabled={style.rolling}>
			<span class="i-lucide-shuffle text-icon-sm"></span>
			{m.showcase_shell_style_btn_shuffle()}
		</Button>
	</div>
</section>

<!-- Section 3: Pick Your Style — the manual path -->
<section class="demo-section" id="shell-style-picker">
	<h2>{m.showcase_shell_style_section_picker()}</h2>
	<p>
		Nothing here is locked. Choose a palette, a typography set and a shape — each one applies on
		click and is remembered for you alone. No account needed.
	</p>

	<StylePicker
		customPalettes={data.customPalettes}
		oncustomize={() => openWorkshop(null)}
		onedit={(cp) => openWorkshop(cp)}
		ondelete={(cp) => (pendingDelete = cp)}
	/>

	{#if workshopOpen}
		{#key workshopKey}
			<CustomPaletteWorkshop
				basePaletteId={style.paletteId}
				existing={editing}
				canSave={signedIn}
				onclose={() => (workshopOpen = false)}
				onsaved={async (palette) => {
					workshopOpen = false;
					await invalidateAll();
					await style.pick({ paletteId: palette.id, paletteName: palette.name }, toast);
					// A custom palette's CSS block is injected only by a full document
					// render, so applying one client-side needs a reload to take effect.
					location.reload();
				}}
			/>
		{/key}
	{/if}

	<h3>{m.showcase_shell_style_section_cascade()}</h3>
	<ol class="cascade">
		<li>
			<strong>Style cookie</strong>
			<span class="cascade-desc">Whatever you last picked or rolled, read before first paint</span>
		</li>
		<li>
			<strong>Custom palette lookup</strong>
			<span class="cascade-desc">A <code>CP_</code> id sends the server to fetch your colors</span>
		</li>
		<li>
			<strong>Randomizer</strong>
			<span class="cascade-desc">No cookie, or one that no longer resolves — a fresh random look</span>
		</li>
	</ol>
	<p class="note">
		The cookie is deliberately readable by JavaScript so the blocking script in
		<code>app.html</code> can apply your style before the page paints — that is what prevents a
		flash of the wrong palette. Signed in, every pick is also mirrored to your account as a backup
		copy.
	</p>
</section>

<ConfirmDialog
	open={pendingDelete !== null}
	title={m.showcase_shell_style_delete_palette_confirm()}
	description={pendingDelete?.name}
	destructive
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>

<style>
	.demo-section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	h3 {
		font-size: var(--text-fluid-lg);
		margin-top: var(--spacing-6);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.9em;
		background: var(--color-subtle);
		padding: 1px 5px;
		border-radius: var(--radius-sm);
	}

	.state-list {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-2) var(--spacing-4);
		margin-bottom: var(--spacing-4);
	}

	.state-list dt {
		font-weight: 600;
		color: var(--color-fg);
	}

	.state-list dd {
		color: var(--color-muted);
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.id-badge {
		font-family: var(--font-mono);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		background: var(--color-subtle);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
	}

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.note {
		font-size: var(--text-fluid-sm);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-2);
	}

	.cascade {
		list-style: none;
		counter-reset: cascade;
		padding: 0;
		margin-bottom: var(--spacing-4);
	}

	.cascade li {
		counter-increment: cascade;
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
		border-bottom: 1px solid var(--color-subtle);
	}

	.cascade li::before {
		content: counter(cascade);
		font-family: var(--font-mono);
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-primary);
		min-width: 1.5ch;
	}

	.cascade li strong {
		color: var(--color-fg);
	}

	.cascade-desc {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
