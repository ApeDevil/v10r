<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import TokenSwatch from './shared/TokenSwatch.svelte';
	import { fontSize, spacing, colorValues, zIndex, borderRadius, boxShadow } from '$lib/styles/tokens';
	import { getTheme } from '$lib/stores/theme.svelte';

	const theme = getTheme();
</script>

<section id="tokens" class="section">
	<h2 class="section-title">Theme Tokens</h2>
	<p class="section-description">Design tokens for consistent styling across the application.</p>

	<div class="demos">
		<!-- Typography -->
		<DemoCard title="Typography Scale" description="Fluid font sizes using clamp()">
			<div class="token-grid">
				{#each Object.entries(fontSize) as [key, value]}
					<div class="type-sample" style="font-size: {value};">
						<span class="type-key">{key}</span>
						<span class="type-value">{value}</span>
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
		<DemoCard title="Colors" description="Light and dark theme color palettes">
			<div class="color-section">
				<h4 class="color-mode-title">Light Mode</h4>
				<div class="token-grid">
					{#each Object.entries(colorValues.light) as [key, value]}
						<TokenSwatch label={key} {value} preview="color" />
					{/each}
				</div>

				<h4 class="color-mode-title">Dark Mode</h4>
				<div class="token-grid">
					{#each Object.entries(colorValues.dark) as [key, value]}
						<TokenSwatch label={key} {value} preview="color" />
					{/each}
				</div>
			</div>
		</DemoCard>

		<!-- Z-Index -->
		<DemoCard title="Z-Index Layers" description="Stacking context hierarchy">
			<div class="token-grid">
				{#each Object.entries(zIndex) as [key, value]}
					<div class="z-index-sample">
						<div class="z-key">{key}</div>
						<div class="z-value">{value}</div>
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
		scroll-margin-top: 80px;
		margin-bottom: 3rem;
	}

	.section-title {
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 2rem 0;
		font-size: 1rem;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.token-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
		width: 100%;
	}

	.type-sample {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.type-key {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.type-value {
		font-size: 0.75rem;
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.spacing-sample {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
	}

	.spacing-visual {
		background: var(--color-primary);
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.spacing-info {
		flex: 1;
		min-width: 0;
	}

	.spacing-key {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-fg);
		font-family: 'Fira Code', monospace;
	}

	.spacing-value {
		font-size: 0.75rem;
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	.color-section {
		width: 100%;
	}

	.color-mode-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 1.5rem 0 1rem 0;
		color: var(--color-fg);
	}

	.color-mode-title:first-child {
		margin-top: 0;
	}

	.z-index-sample {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.z-key {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-fg);
		font-family: 'Fira Code', monospace;
	}

	.z-value {
		font-size: 0.875rem;
		color: var(--color-muted);
		font-family: 'Fira Code', monospace;
	}

	@media (max-width: 640px) {
		.token-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
