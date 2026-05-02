<script lang="ts">
import {
	categories,
	type FontCategory,
	type FontLoadState,
	findFont,
	fontPairings,
	getFontsByCategory,
} from '$lib/utils/fonts';

interface Props {
	mode: 'single' | 'pairing';
	selected: string;
	headingFont: string;
	bodyFont: string;
	loadState: FontLoadState;
	headingLoadState: FontLoadState;
	bodyLoadState: FontLoadState;
	onselect: (family: string) => void;
	onselectHeading: (family: string) => void;
	onselectBody: (family: string) => void;
	onmodechange: (mode: 'single' | 'pairing') => void;
}

let {
	mode,
	selected,
	headingFont,
	bodyFont,
	loadState,
	headingLoadState,
	bodyLoadState,
	onselect,
	onselectHeading,
	onselectBody,
	onmodechange,
}: Props = $props();

let activeCategory = $state<FontCategory>('sans-serif');

let fontsInCategory = $derived(getFontsByCategory(activeCategory));
let selectedMeta = $derived(mode === 'single' ? findFont(selected) : null);

function swapFonts() {
	const prev = headingFont;
	onselectHeading(bodyFont);
	onselectBody(prev);
}
</script>

<div class="font-picker">
	<!-- Mode toggle -->
	<div class="mode-toggle">
		<button
			class="mode-btn"
			class:active={mode === 'single'}
			onclick={() => onmodechange('single')}
		>
			Single Font
		</button>
		<button
			class="mode-btn"
			class:active={mode === 'pairing'}
			onclick={() => onmodechange('pairing')}
		>
			Pairing
		</button>
	</div>

	<!-- Category tabs -->
	<div class="tabs" role="tablist">
		{#each categories as cat}
			<button
				role="tab"
				aria-selected={activeCategory === cat.key}
				class="tab"
				class:active={activeCategory === cat.key}
				onclick={() => (activeCategory = cat.key)}
			>
				{cat.label}
			</button>
		{/each}
	</div>

	{#if mode === 'single'}
		<!-- Single mode: one font list -->
		<div class="font-list" role="tabpanel">
			{#each fontsInCategory as font}
				{@const isSelected = selected === font.family}
				<button
					class="font-option"
					class:selected={isSelected}
					onclick={() => onselect(font.family)}
					aria-pressed={isSelected}
				>
					<span class="font-name">{font.family}</span>
					{#if font.variable}
						<span class="badge">Variable</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if selectedMeta}
			<div class="font-meta">
				<p class="meta-note">{selectedMeta.note}</p>
				{#if loadState === 'loading'}
					<span class="meta-status loading">Loading...</span>
				{:else if loadState === 'error'}
					<span class="meta-status error">Failed to load</span>
				{/if}
			</div>
		{/if}
	{:else}
		<!-- Pairing mode: dual font lists -->
		<div class="pairing-sections">
			<div class="pairing-section">
				<div class="section-header">
					<span class="section-label">Heading</span>
					{#if headingLoadState === 'loading'}
						<span class="meta-status loading">Loading...</span>
					{:else if headingLoadState === 'error'}
						<span class="meta-status error">Failed</span>
					{/if}
				</div>
				<div class="font-list compact" role="listbox" aria-label="Heading font">
					{#each fontsInCategory as font}
						{@const isSelected = headingFont === font.family}
						<button
							class="font-option"
							class:selected={isSelected}
							onclick={() => onselectHeading(font.family)}
							aria-pressed={isSelected}
						>
							<span class="font-name">{font.family}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="swap-row">
				<button class="swap-btn" onclick={swapFonts} title="Swap heading and body fonts">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
						<path d="M4 3v10M4 13l-2.5-2.5M4 13l2.5-2.5M12 13V3M12 3L9.5 5.5M12 3l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					Swap
				</button>
			</div>

			<div class="pairing-section">
				<div class="section-header">
					<span class="section-label">Body</span>
					{#if bodyLoadState === 'loading'}
						<span class="meta-status loading">Loading...</span>
					{:else if bodyLoadState === 'error'}
						<span class="meta-status error">Failed</span>
					{/if}
				</div>
				<div class="font-list compact" role="listbox" aria-label="Body font">
					{#each fontsInCategory as font}
						{@const isSelected = bodyFont === font.family}
						<button
							class="font-option"
							class:selected={isSelected}
							onclick={() => onselectBody(font.family)}
							aria-pressed={isSelected}
						>
							<span class="font-name">{font.family}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Preset pairings -->
		<div class="presets">
			<span class="presets-label">Presets</span>
			<div class="preset-list">
				{#each fontPairings as pairing}
					{@const isActive = headingFont === pairing.heading && bodyFont === pairing.body}
					<button
						class="preset-card"
						class:active={isActive}
						onclick={() => {
							onselectHeading(pairing.heading);
							onselectBody(pairing.body);
						}}
					>
						<span class="preset-name">{pairing.name}</span>
						<span class="preset-desc">{pairing.description}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.font-picker {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		overflow: hidden;
	}

	/* Mode toggle */
	.mode-toggle {
		display: flex;
		border-bottom: 1px solid var(--color-border);
	}

	.mode-btn {
		flex: 1;
		padding: var(--spacing-3) var(--spacing-4);
		border: none;
		background: none;
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		transition: color var(--duration-fast), background-color var(--duration-fast);
	}

	.mode-btn:hover {
		color: var(--color-fg);
	}

	.mode-btn.active {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		font-weight: 600;
	}

	/* Category tabs */
	.tabs {
		display: flex;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.tab {
		flex: 1;
		padding: var(--spacing-3) var(--spacing-4);
		border: none;
		background: none;
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		transition: color var(--duration-fast);
		position: relative;
	}

	.tab:hover {
		color: var(--color-fg);
	}

	.tab.active {
		color: var(--color-fg);
		font-weight: 600;
	}

	.tab.active::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: var(--spacing-4);
		right: var(--spacing-4);
		height: 2px;
		background: var(--color-primary);
		border-radius: 1px 1px 0 0;
	}

	/* Font list */
	.font-list {
		display: flex;
		flex-direction: column;
		max-height: 280px;
		overflow-y: auto;
	}

	.font-list.compact {
		max-height: 140px;
	}

	.font-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-3) var(--spacing-5);
		border: none;
		background: none;
		cursor: pointer;
		text-align: left;
		color: var(--color-fg);
		font-size: var(--text-fluid-base);
		transition: background-color var(--duration-fast);
	}

	.font-option:hover {
		background: var(--color-subtle);
	}

	.font-option.selected {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		font-weight: 500;
	}

	.font-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge {
		flex-shrink: 0;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px var(--spacing-2);
		border-radius: var(--radius-sm);
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	/* Font meta (single mode) */
	.font-meta {
		padding: var(--spacing-3) var(--spacing-5);
		border-top: 1px solid var(--color-border);
		background: var(--color-subtle);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.meta-note {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.4;
	}

	.meta-status {
		flex-shrink: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.meta-status.loading {
		color: var(--color-primary);
	}

	.meta-status.error {
		color: var(--color-error);
	}

	/* Pairing sections */
	.pairing-sections {
		display: flex;
		flex-direction: column;
	}

	.pairing-section {
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-2) var(--spacing-5);
		background: var(--color-subtle);
		border-bottom: 1px solid var(--color-border);
	}

	.section-label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Swap button */
	.swap-row {
		display: flex;
		justify-content: center;
		padding: var(--spacing-1) 0;
		border-top: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-subtle);
	}

	.swap-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-1) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--surface-1);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: color var(--duration-fast), border-color var(--duration-fast);
	}

	.swap-btn:hover {
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	/* Presets */
	.presets {
		border-top: 1px solid var(--color-border);
		padding: var(--spacing-3) var(--spacing-5);
		background: var(--color-subtle);
	}

	.presets-label {
		display: block;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--spacing-3);
	}

	.preset-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.preset-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--surface-1);
		cursor: pointer;
		text-align: left;
		transition: border-color var(--duration-fast);
	}

	.preset-card:hover {
		border-color: var(--color-primary);
	}

	.preset-card.active {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.preset-name {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.preset-desc {
		font-size: 0.6875rem;
		color: var(--color-muted);
		line-height: 1.3;
	}
</style>
