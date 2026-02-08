<script lang="ts">
	import { DemoCard, TokenSwatch } from '../_components';
	import { fontSize, spacing, zIndex, borderRadius, boxShadow } from '$lib/styles/tokens';

	/** Maps z-index layers to their surface level based on actual component usage */
	const zSurface: Record<string, number> = {
		base: 0,
		sidebar: 1,
		fab: 1,
		overlay: 2,
		drawer: 2,
		popover: 2,
		dropdown: 2,
		modal: 3,
		toast: 1,
		tooltip: 3,
	};

	/**
	 * Color token names - actual values live in app.css (single source of truth).
	 * We display these with their CSS variable references.
	 */
	const colorTokens = [
		{ name: 'bg', var: '--color-bg' },
		{ name: 'fg', var: '--color-fg' },
		{ name: 'muted', var: '--color-muted' },
		{ name: 'border', var: '--color-border' },
		{ name: 'subtle', var: '--color-subtle' },
		{ name: 'primary', var: '--color-primary' },
		{ name: 'primary-hover', var: '--color-primary-hover' },
		{ name: 'primary-light', var: '--color-primary-light' },
		{ name: 'success', var: '--color-success' },
		{ name: 'success-light', var: '--color-success-light' },
		{ name: 'warning', var: '--color-warning' },
		{ name: 'warning-hover', var: '--color-warning-hover' },
		{ name: 'warning-light', var: '--color-warning-light' },
		{ name: 'error', var: '--color-error' },
		{ name: 'error-light', var: '--color-error-light' },
		{ name: 'error-border', var: '--color-error-border' },
		{ name: 'input-border', var: '--color-input-border' },
	];
</script>

<section id="tokens" class="section">
	<h2 class="section-title">Theme Tokens</h2>
	<p class="section-description">Design tokens for consistent styling across the application.</p>

	<div class="demos">
		<!-- Typography -->
		<DemoCard title="Typography Scale" description="Fluid font sizes using clamp() — resize your window to see text scale">
			<div class="type-scale">
				{#each Object.entries(fontSize) as [key, value]}
					<div class="type-sample">
						<div class="type-meta">
							<span class="type-key">{key}</span>
							<span class="type-value">{value}</span>
						</div>
						<div class="type-preview" style="font-size: {value};">
							The quick brown fox jumps over the lazy dog
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>

		<!-- Spacing -->
		<DemoCard title="Spacing Scale" description="Fluid spacing for margins, padding, gaps">
			<div class="token-grid">
				{#each Object.entries(spacing) as [key, value]}
					<div class="spacing-sample">
						<div class="spacing-visual" style="width: {value}; height: {value};"></div>
						<div class="spacing-info">
							<div class="spacing-key">{key}</div>
							<div class="spacing-value">{value}</div>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>

		<!-- Colors -->
		<DemoCard title="Colors" description="Semantic color tokens (toggle theme to see dark mode)">
			<div class="color-section">
				<p class="color-note">Single source of truth: <code>src/app.css</code></p>
				<div class="token-grid">
					{#each colorTokens as token}
						<div class="color-swatch">
							<div class="color-preview" style="background: var({token.var});"></div>
							<div class="color-info">
								<div class="color-name">{token.name}</div>
								<div class="color-var">{token.var}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</DemoCard>

		<!-- Z-Index -->
		<DemoCard title="Z-Index Layers" description="Stacking context hierarchy — colored by surface elevation">
			<div class="z-index-stack">
				{#each Object.entries(zIndex) as [key, value]}
					{@const level = zSurface[key] ?? 0}
					<div
						class="z-index-sample"
						style="background: var(--surface-{level});"
					>
						<div class="z-info">
							<span class="z-key">{key}</span>
							<span class="z-surface">surface-{level}</span>
						</div>
						<div class="z-value">{value}</div>
					</div>
				{/each}
			</div>
		</DemoCard>

		<!-- Surface Elevation -->
		<DemoCard title="Surface Elevation" description="4 elevation levels — higher = whiter in light, darker in dark">
			<div class="surface-grid">
				{#each [
					{ level: 0, label: 'Surface 0', usage: 'Page background' },
					{ level: 1, label: 'Surface 1', usage: 'Cards, sidebar' },
					{ level: 2, label: 'Surface 2', usage: 'Dropdowns, popovers' },
					{ level: 3, label: 'Surface 3', usage: 'Modals, tooltips' }
				] as surface}
					<div
						class="surface-swatch"
						style="background: var(--surface-{surface.level});"
					>
						<div class="surface-label">{surface.label}</div>
						<div class="surface-usage">{surface.usage}</div>
						<code class="surface-class">bg-surface-{surface.level}</code>
					</div>
				{/each}
			</div>
		</DemoCard>

		<!-- Border Radius -->
		<DemoCard title="Border Radius" description="Corner rounding values">
			<div class="token-grid">
				{#each Object.entries(borderRadius) as [key, value]}
					<TokenSwatch label={key} {value} preview="radius" />
				{/each}
			</div>
		</DemoCard>

		<!-- Box Shadow -->
		<DemoCard title="Box Shadows" description="Elevation and depth">
			<div class="token-grid">
				{#each Object.entries(boxShadow) as [key, value]}
					<TokenSwatch label={key} {value} preview="shadow" />
				{/each}
			</div>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.token-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.type-scale {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
	}

	.type-sample {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.type-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-4);
	}

	.type-key {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-fg);
		font-family: 'Fira Code', monospace;
	}

	.type-value {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.type-preview {
		color: var(--color-fg);
		line-height: 1.4;
	}

	.spacing-sample {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.spacing-visual {
		background: var(--color-primary);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.spacing-info {
		flex: 1;
		min-width: 0;
	}

	.spacing-key {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		font-family: 'Fira Code', monospace;
	}

	.spacing-value {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.color-section {
		width: 100%;
	}

	.color-note {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-4) 0;
	}

	.color-note code {
		background: var(--color-subtle);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-family: 'Fira Code', monospace;
		font-size: var(--text-fluid-xs);
	}

	.color-swatch {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.color-preview {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.color-info {
		flex: 1;
		min-width: 0;
	}

	.color-name {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}

	.color-var {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.z-index-stack {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.z-index-sample {
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		display: flex;
		justify-content: space-between;
		align-items: center;
		border: 1px solid var(--color-border);
	}

	.z-info {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
	}

	.z-key {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		font-family: 'Fira Code', monospace;
	}

	.z-surface {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.z-value {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 600;
		font-family: 'Fira Code', monospace;
	}

	.surface-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.surface-swatch {
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.surface-label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.surface-usage {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.surface-class {
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	@media (max-width: 640px) {
		.token-grid,
		.surface-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
