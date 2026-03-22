<script lang="ts">
import type { PageData } from './$types';
import { Button } from '$lib/components/primitives';
import { getTheme } from '$lib/state/theme.svelte';
import { getStyle } from '$lib/state/style.svelte';
import { getToast } from '$lib/state/toast.svelte';
import {
	PALETTE_REGISTRY,
	TYPOGRAPHY_REGISTRY,
	RADIUS_REGISTRY,
	getPalette,
	getTypography,
	getRadius,
} from '$lib/styles/random';
import type { PaletteId, TypographyId, RadiusId } from '$lib/styles/random/types';

let { data }: { data: PageData } = $props();

const theme = getTheme();
const style = getStyle();
const toast = getToast();

const brandPaletteName = $derived(
	data.brand ? getPalette(data.brand.paletteId as PaletteId)?.name ?? data.brand.paletteId : null,
);
const brandTypographyName = $derived(
	data.brand
		? getTypography(data.brand.typographyId as TypographyId)?.name ?? data.brand.typographyId
		: null,
);
const brandRadiusName = $derived(
	data.brand ? getRadius(data.brand.radiusId as RadiusId)?.name ?? data.brand.radiusId : null,
);

const totalCombinations = PALETTE_REGISTRY.length * TYPOGRAPHY_REGISTRY.length * RADIUS_REGISTRY.length;
</script>

<svelte:head>
	<title>Style - Shell - Showcases - Velociraptor</title>
</svelte:head>

<!-- Section 1: Theme -->
<section class="demo-section">
	<h2>Theme</h2>
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
		<Button variant="secondary" onclick={() => theme.setMode('light')}>Light</Button>
		<Button variant="secondary" onclick={() => theme.setMode('dark')}>Dark</Button>
		<Button variant="secondary" onclick={() => theme.setMode('system')}>System</Button>
	</div>
</section>

<!-- Section 2: Style Randomizer -->
<section class="demo-section">
	<h2>Style Randomizer</h2>
	<p>
		{PALETTE_REGISTRY.length} palettes &times; {TYPOGRAPHY_REGISTRY.length} typography sets &times;
		{RADIUS_REGISTRY.length} radius presets = <strong>{totalCombinations} combinations</strong>.
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

	{#if !style.branded}
		<div class="button-group">
			<Button variant="secondary" onclick={() => style.roll(toast)} disabled={style.rolling}>
				{#if style.rolling}
					Rolling...
				{:else}
					Roll the dice
				{/if}
			</Button>
			<Button variant="secondary" onclick={() => style.roll(toast)} disabled={style.rolling}>
				<span class="i-lucide-shuffle text-icon-sm"></span>
				Shuffle
			</Button>
		</div>
	{:else}
		<p class="note">Dice roll disabled — visual identity is locked.</p>
	{/if}

	<div class="registry">
		<div class="registry-group">
			<h3>Palettes</h3>
			<div class="chip-list">
				{#each PALETTE_REGISTRY as p}
					<span class="chip" class:active={style.paletteId === p.id}>{p.name}</span>
				{/each}
			</div>
		</div>

		<div class="registry-group">
			<h3>Typography</h3>
			<div class="chip-list">
				{#each TYPOGRAPHY_REGISTRY as t}
					<span class="chip" class:active={style.typographyId === t.id}>{t.name}</span>
				{/each}
			</div>
		</div>

		<div class="registry-group">
			<h3>Radius</h3>
			<div class="chip-list">
				{#each RADIUS_REGISTRY as r}
					<span class="chip" class:active={style.radiusId === r.id}>{r.name}</span>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- Section 3: Visual Identity -->
<section class="demo-section">
	<h2>Visual Identity</h2>
	<p>Lock your brand — all visitors see the same design.</p>

	{#if data.brand}
		<dl class="state-list">
			<dt>Status:</dt>
			<dd>
				{#if data.brand.enabled}
					<span class="status-badge status-locked">Locked</span>
				{:else}
					<span class="status-badge status-unlocked">Unlocked</span>
				{/if}
			</dd>

			<dt>Palette:</dt>
			<dd>{brandPaletteName} <span class="id-badge">{data.brand.paletteId}</span></dd>

			<dt>Typography:</dt>
			<dd>{brandTypographyName} <span class="id-badge">{data.brand.typographyId}</span></dd>

			<dt>Radius:</dt>
			<dd>{brandRadiusName} <span class="id-badge">{data.brand.radiusId}</span></dd>
		</dl>

		{#if data.brand.enabled}
			<p class="note">
				Visual identity is live — all visitors see <strong>{brandPaletteName}</strong> palette
				with <strong>{brandTypographyName}</strong> typography.
			</p>
		{:else}
			<p class="note">
				Visual identity is configured but unlocked — visitors still see random styles.
			</p>
		{/if}
	{:else}
		<p class="note">
			No visual identity configured. Visitors see a random style on each visit.
		</p>
	{/if}

	<h3>Priority Cascade</h3>
	<ol class="cascade">
		<li>
			<strong>Brand cookie</strong>
			<span class="cascade-desc">Visual identity locked by admin</span>
		</li>
		<li>
			<strong>User cookie</strong>
			<span class="cascade-desc">Visitor's current randomizer style</span>
		</li>
		<li>
			<strong>Randomizer</strong>
			<span class="cascade-desc">Fresh random style for new visitors</span>
		</li>
	</ol>

	<p>
		<a href="/app/admin/branding" class="admin-link">Configure Visual Identity &rarr;</a>
	</p>
</section>

<style>
	.demo-section {
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
		margin-top: var(--spacing-4);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
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

	.registry {
		margin-top: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.registry-group h3 {
		margin-top: 0;
		font-size: var(--text-fluid-base);
	}

	.chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.chip {
		font-size: var(--text-fluid-sm);
		padding: 2px 10px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		color: var(--color-muted);
		background: transparent;
		transition: all var(--duration-fast);
	}

	.chip.active {
		color: var(--color-on-primary);
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.status-badge {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		padding: 2px 10px;
		border-radius: var(--radius-full);
	}

	.status-locked {
		color: var(--color-on-primary);
		background: var(--color-primary);
	}

	.status-unlocked {
		color: var(--color-muted);
		background: var(--color-subtle);
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

	.admin-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	.admin-link:hover {
		text-decoration: underline;
	}
</style>
