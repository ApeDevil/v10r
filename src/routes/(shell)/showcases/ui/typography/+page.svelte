<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { type FontLoadState, findFont, isFontLoaded, loadFont } from '$lib/utils/fonts';
import FontPicker from './_components/FontPicker.svelte';
import FontPreview from './_components/FontPreview.svelte';
import ProsePreview from './_components/ProsePreview.svelte';

// --- Mode state ---
// svelte-ignore state_referenced_locally
const urlHeading = page.url.searchParams.get('heading');
// svelte-ignore state_referenced_locally
const urlBody = page.url.searchParams.get('body');
// svelte-ignore state_referenced_locally
const urlView = page.url.searchParams.get('view');

// svelte-ignore state_referenced_locally
let mode = $state<'single' | 'pairing'>(urlHeading && urlBody ? 'pairing' : 'single');
// svelte-ignore state_referenced_locally
let viewMode = $state<'scale' | 'prose'>(urlView === 'prose' ? 'prose' : 'scale');

// --- Single mode ---
// svelte-ignore state_referenced_locally
let selectedFamily = $state(page.url.searchParams.get('font') ?? 'System');
let loadState = $state<FontLoadState>('idle');

// --- Pairing mode ---
// svelte-ignore state_referenced_locally
let headingFamily = $state(urlHeading ?? 'Playfair Display');
// svelte-ignore state_referenced_locally
let bodyFamily = $state(urlBody ?? 'Inter');
let headingLoadState = $state<FontLoadState>('idle');
let bodyLoadState = $state<FontLoadState>('idle');

// --- Derived font stacks ---
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

// --- URL sync ---
function syncUrl() {
	const url = new URL(page.url);

	// Clear all font params first
	url.searchParams.delete('font');
	url.searchParams.delete('heading');
	url.searchParams.delete('body');
	url.searchParams.delete('view');

	if (mode === 'single') {
		if (selectedFamily !== 'System') {
			url.searchParams.set('font', selectedFamily);
		}
	} else {
		url.searchParams.set('heading', headingFamily);
		url.searchParams.set('body', bodyFamily);
	}

	if (viewMode === 'prose') {
		url.searchParams.set('view', 'prose');
	}

	goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
}

// --- Font loading helpers ---
async function doLoadFont(family: string): Promise<void> {
	if (family === 'System' || isFontLoaded(family)) return;
	const meta = findFont(family);
	if (!meta) return;
	await loadFont(meta.family, meta.weights);
}

// --- Single mode selection ---
async function selectFont(family: string) {
	selectedFamily = family;
	syncUrl();

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

// --- Pairing mode selection ---
async function selectHeadingFont(family: string) {
	headingFamily = family;
	syncUrl();

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

async function selectBodyFont(family: string) {
	bodyFamily = family;
	syncUrl();

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

// --- Mode switch ---
function handleModeChange(newMode: 'single' | 'pairing') {
	mode = newMode;
	if (newMode === 'pairing') {
		// Trigger loading both fonts
		selectHeadingFont(headingFamily);
		selectBodyFont(bodyFamily);
	}
	syncUrl();
}

function handleViewChange(newView: 'scale' | 'prose') {
	viewMode = newView;
	syncUrl();
}

// --- Load initial fonts if arriving via URL params ---
// svelte-ignore state_referenced_locally
if (mode === 'pairing') {
	selectHeadingFont(headingFamily);
	selectBodyFont(bodyFamily);
} else if (selectedFamily !== 'System') {
	selectFont(selectedFamily);
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
					Type Scale
				</button>
				<button
					role="tab"
					aria-selected={viewMode === 'prose'}
					class="view-tab"
					class:active={viewMode === 'prose'}
					onclick={() => handleViewChange('prose')}
				>
					Prose
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
