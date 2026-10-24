<script lang="ts">
import * as m from '#lib/paraglide/messages.js';
import { createUrlState } from '#lib/state/url-state.svelte.ts';
import { urlParam } from '#lib/state/url-state.ts';
import { type FontLoadState, findFont, isFontLoaded, loadFont } from '#lib/utils/fonts/index.ts';
import FontPicker from './_components/FontPicker.svelte';
import FontPreview from './_components/FontPreview.svelte';
import ProsePreview from './_components/ProsePreview.svelte';

// The picks are view state no load reads, so the URL mirrors them with shallow writes.
// `heading` and `body` together mean pairing mode; `font` is the single-font pick.
const fontUrl = createUrlState(
	{
		font: urlParam.text('System'),
		heading: urlParam.text(),
		body: urlParam.text(),
		view: urlParam.oneOf(['scale', 'prose'], 'scale'),
	},
	{ write: 'shallow' },
);
const fromUrl = fontUrl.values;

let mode = $state<'single' | 'pairing'>(fromUrl.heading && fromUrl.body ? 'pairing' : 'single');
let viewMode = $state(fromUrl.view);

let selectedFamily = $state(fromUrl.font);
let loadState = $state<FontLoadState>('idle');

let headingFamily = $state(fromUrl.heading || 'Playfair Display');
let bodyFamily = $state(fromUrl.body || 'Inter');
let headingLoadState = $state<FontLoadState>('idle');
let bodyLoadState = $state<FontLoadState>('idle');

function buildFontStack(family: string): string {
	const meta = findFont(family);
	if (!meta || meta.family === 'System') {
		return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
	}
	return `'${meta.family}', ${meta.fallback}`;
}

let fontStack = $derived(buildFontStack(selectedFamily));
let headingFontStack = $derived(buildFontStack(headingFamily));
let bodyFontStack = $derived(buildFontStack(bodyFamily));

function mirrorPicksToUrl() {
	fontUrl.set(
		mode === 'single'
			? { font: selectedFamily, heading: '', body: '', view: viewMode }
			: { font: 'System', heading: headingFamily, body: bodyFamily, view: viewMode },
	);
}

async function doLoadFont(family: string): Promise<void> {
	if (family === 'System' || isFontLoaded(family)) return;
	const meta = findFont(family);
	if (!meta) return;
	await loadFont(meta.family, meta.weights);
}

async function selectFont(family: string, mirror = true) {
	selectedFamily = family;
	if (mirror) mirrorPicksToUrl();

	if (family !== 'System' && !isFontLoaded(family)) {
		loadState = 'loading';
		try {
			await doLoadFont(family);
			loadState = 'loaded';
		} catch {
			loadState = 'error';
		}
	} else {
		loadState = family === 'System' ? 'idle' : 'loaded';
	}
}

async function selectHeadingFont(family: string, mirror = true) {
	headingFamily = family;
	if (mirror) mirrorPicksToUrl();

	if (family !== 'System' && !isFontLoaded(family)) {
		headingLoadState = 'loading';
		try {
			await doLoadFont(family);
			headingLoadState = 'loaded';
		} catch {
			headingLoadState = 'error';
		}
	} else {
		headingLoadState = family === 'System' ? 'idle' : 'loaded';
	}
}

async function selectBodyFont(family: string, mirror = true) {
	bodyFamily = family;
	if (mirror) mirrorPicksToUrl();

	if (family !== 'System' && !isFontLoaded(family)) {
		bodyLoadState = 'loading';
		try {
			await doLoadFont(family);
			bodyLoadState = 'loaded';
		} catch {
			bodyLoadState = 'error';
		}
	} else {
		bodyLoadState = family === 'System' ? 'idle' : 'loaded';
	}
}

function handleModeChange(newMode: 'single' | 'pairing') {
	mode = newMode;
	if (newMode === 'pairing') {
		// Trigger loading both fonts
		selectHeadingFont(headingFamily);
		selectBodyFont(bodyFamily);
	}
	mirrorPicksToUrl();
}

function handleViewChange(newView: 'scale' | 'prose') {
	viewMode = newView;
	mirrorPicksToUrl();
}

// Load initial fonts if arriving via URL params. The URL already holds these picks, and the
// router cannot take a write during initialisation, so they load without mirroring.
// svelte-ignore state_referenced_locally
if (mode === 'pairing') {
	selectHeadingFont(headingFamily, false);
	selectBodyFont(bodyFamily, false);
} else if (selectedFamily !== 'System') {
	selectFont(selectedFamily, false);
}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<main class="content">
	<div class="layout">
		<aside class="sidebar">
			<FontPicker
				{mode}
				selected={selectedFamily}
				headingFont={headingFamily}
				bodyFont={bodyFamily}
				{loadState}
				{headingLoadState}
				{bodyLoadState}
				onselect={selectFont}
				onselectHeading={selectHeadingFont}
				onselectBody={selectBodyFont}
				onmodechange={handleModeChange}
			/>
		</aside>

		<section class="preview-area">
			<div class="view-toggle" role="tablist">
				<button
					role="tab"
					aria-selected={viewMode === 'scale'}
					class="view-tab"
					class:active={viewMode === 'scale'}
					onclick={() => handleViewChange('scale')}
				>
					{m.showcase_ui_typography_tab_scale()}
				</button>
				<button
					role="tab"
					aria-selected={viewMode === 'prose'}
					class="view-tab"
					class:active={viewMode === 'prose'}
					onclick={() => handleViewChange('prose')}
				>
					{m.showcase_ui_typography_tab_prose()}
				</button>
			</div>

			{#if viewMode === 'scale'}
				<FontPreview
					{mode}
					{fontStack}
					{headingFontStack}
					{bodyFontStack}
					{loadState}
					{headingLoadState}
					{bodyLoadState}
				/>
			{:else}
				<ProsePreview
					{mode}
					{fontStack}
					{headingFontStack}
					{bodyFontStack}
					{loadState}
					{headingLoadState}
					{bodyLoadState}
				/>
			{/if}
		</section>
	</div>
</main>

<style>
	.layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.sidebar {
		flex-shrink: 0;
	}

	.preview-area {
		flex: 1;
		min-width: 0;
	}

	.view-toggle {
		display: flex;
		gap: 0;
		margin-bottom: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		width: fit-content;
	}

	.view-tab {
		padding: var(--spacing-2) var(--spacing-5);
		border: none;
		background: none;
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		transition: color var(--duration-fast), background-color var(--duration-fast);
	}

	.view-tab:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.view-tab.active {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		font-weight: 600;
	}

	@media (min-width: 1024px) {
		.layout {
			flex-direction: row;
		}

		.sidebar {
			width: 300px;
			position: sticky;
			top: var(--spacing-7);
			align-self: flex-start;
		}
	}
</style>
