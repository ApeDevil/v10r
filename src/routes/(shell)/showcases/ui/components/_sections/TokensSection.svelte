<script lang="ts">
	import { DemoCard, TokenSwatch } from '../_components';
	import {
		fontSize,
		iconSize,
		spacing,
		breakpoints,
		containers,
		zIndex,
		duration,
		sidebar,
		layout
	} from '$lib/styles/tokens';

	/** Border radius tokens (display-only, reference CSS variables from app.css) */
	const borderRadius = {
		sm: '0.25rem',
		md: '0.375rem',
		lg: '0.5rem',
		xl: '0.75rem',
		full: '9999px',
	};

	/** Box shadow tokens (display-only, reference CSS variables from app.css) */
	const boxShadow = {
		sm: 'var(--shadow-sm)',
		md: 'var(--shadow-md)',
		lg: 'var(--shadow-lg)',
		xl: 'var(--shadow-xl)',
		modal: 'var(--shadow-modal)',
		'glow-primary': 'var(--shadow-glow-primary)',
		'glow-warning': 'var(--shadow-glow-warning)',
	};

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
	 * Color token groups — actual values live in app.css (single source of truth).
	 * We display these with their CSS variable references, grouped by semantic role.
	 */
	const colorGroups = [
		{
			label: 'Base',
			tokens: [
				{ name: 'bg', var: '--color-bg' },
				{ name: 'fg', var: '--color-fg' },
				{ name: 'body', var: '--color-body' },
				{ name: 'muted', var: '--color-muted' },
				{ name: 'border', var: '--color-border' },
				{ name: 'subtle', var: '--color-subtle' },
			],
		},
		{
			label: 'Semi-transparent',
			tokens: [
				{ name: 'bg-alpha', var: '--color-bg-alpha' },
				{ name: 'fg-alpha', var: '--color-fg-alpha' },
			],
		},
		{
			label: 'Primary',
			tokens: [
				{ name: 'primary', var: '--color-primary' },
				{ name: 'primary-hover', var: '--color-primary-hover' },
				{ name: 'primary-bg', var: '--color-primary-bg' },
				{ name: 'primary-fg', var: '--color-primary-fg' },
				{ name: 'primary-light', var: '--color-primary-light' },
			],
		},
		{
			label: 'Success',
			tokens: [
				{ name: 'success', var: '--color-success' },
				{ name: 'success-bg', var: '--color-success-bg' },
				{ name: 'success-fg', var: '--color-success-fg' },
				{ name: 'success-light', var: '--color-success-light' },
			],
		},
		{
			label: 'Warning',
			tokens: [
				{ name: 'warning', var: '--color-warning' },
				{ name: 'warning-hover', var: '--color-warning-hover' },
				{ name: 'warning-bg', var: '--color-warning-bg' },
				{ name: 'warning-fg', var: '--color-warning-fg' },
				{ name: 'warning-light', var: '--color-warning-light' },
			],
		},
		{
			label: 'Error',
			tokens: [
				{ name: 'error', var: '--color-error' },
				{ name: 'error-bg', var: '--color-error-bg' },
				{ name: 'error-fg', var: '--color-error-fg' },
				{ name: 'error-light', var: '--color-error-light' },
				{ name: 'error-border', var: '--color-error-border' },
			],
		},
		{
			label: 'Info',
			tokens: [
				{ name: 'info', var: '--color-info' },
				{ name: 'info-bg', var: '--color-info-bg' },
				{ name: 'info-fg', var: '--color-info-fg' },
				{ name: 'info-light', var: '--color-info-light' },
			],
		},
		{
			label: 'Secondary',
			tokens: [
				{ name: 'secondary-bg', var: '--color-secondary-bg' },
				{ name: 'secondary-fg', var: '--color-secondary-fg' },
			],
		},
		{
			label: 'Input',
			tokens: [
				{ name: 'input-border', var: '--color-input-border' },
				{ name: 'input-bg', var: '--color-input-bg' },
			],
		},
	];

	/**
	 * Color combinations — how tokens are actually paired in components.
	 * Each combo shows bg + fg + optional border/accent, with where it's used.
	 */
	const colorCombos = [
		{
			label: 'Solid fills',
			combos: [
				{
					name: 'Default',
					bg: 'var(--color-fg)',
					fg: 'var(--color-bg)',
					usage: 'Button default',
				},
				{
					name: 'Primary',
					bg: 'var(--color-primary-bg)',
					fg: 'var(--color-primary-fg)',
					border: 'var(--color-primary)',
					usage: 'Button, Alert, Badge',
				},
				{
					name: 'Secondary',
					bg: 'var(--color-secondary-bg)',
					fg: 'var(--color-secondary-fg)',
					usage: 'Button secondary',
				},
				{
					name: 'Destructive',
					bg: 'var(--color-error-bg)',
					fg: 'var(--color-error-fg)',
					border: 'var(--color-error)',
					usage: 'Button destructive, Alert',
				},
				{
					name: 'Ghost',
					bg: 'transparent',
					fg: 'var(--color-primary)',
					border: 'var(--color-border)',
					usage: 'Button ghost, outline',
				},
			],
		},
		{
			label: 'Status',
			combos: [
				{
					name: 'Success',
					bg: 'var(--color-success-bg)',
					fg: 'var(--color-success-fg)',
					border: 'var(--color-success)',
					usage: 'Alert, Badge',
				},
				{
					name: 'Warning',
					bg: 'var(--color-warning-bg)',
					fg: 'var(--color-warning-fg)',
					border: 'var(--color-warning)',
					usage: 'Alert, Badge',
				},
				{
					name: 'Error',
					bg: 'var(--color-error-bg)',
					fg: 'var(--color-error-fg)',
					border: 'var(--color-error)',
					usage: 'Alert, Badge',
				},
				{
					name: 'Info',
					bg: 'var(--color-info-bg)',
					fg: 'var(--color-info-fg)',
					border: 'var(--color-info)',
					usage: 'Alert, Badge',
				},
			],
		},
		{
			label: 'Tinted (color-mix)',
			combos: [
				{
					name: 'Primary tint',
					bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
					fg: 'var(--color-primary)',
					usage: 'Badge, Tag',
				},
				{
					name: 'Success tint',
					bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
					fg: 'var(--color-success)',
					usage: 'Badge',
				},
				{
					name: 'Warning tint',
					bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
					fg: 'var(--color-warning)',
					usage: 'Badge',
				},
				{
					name: 'Error tint',
					bg: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
					fg: 'var(--color-error)',
					usage: 'Badge',
				},
				{
					name: 'Muted tint',
					bg: 'color-mix(in srgb, var(--color-muted) 20%, transparent)',
					fg: 'var(--color-muted)',
					usage: 'Badge secondary',
				},
			],
		},
		{
			label: 'Surfaces',
			combos: [
				{
					name: 'Page',
					bg: 'var(--color-bg)',
					fg: 'var(--color-body)',
					usage: 'Page body',
				},
				{
					name: 'Card',
					bg: 'var(--surface-1)',
					fg: 'var(--color-fg)',
					border: 'var(--color-border)',
					usage: 'Cards, sidebar',
				},
				{
					name: 'Overlay',
					bg: 'var(--surface-2)',
					fg: 'var(--color-fg)',
					border: 'var(--color-border)',
					usage: 'Dropdown, popover',
				},
				{
					name: 'Modal',
					bg: 'var(--surface-3)',
					fg: 'var(--color-fg)',
					border: 'var(--color-border)',
					usage: 'Modal, tooltip',
				},
			],
		},
		{
			label: 'Input',
			combos: [
				{
					name: 'Input default',
					bg: 'var(--color-input-bg)',
					fg: 'var(--color-body)',
					border: 'var(--color-input-border)',
					usage: 'Input, Select, Combobox',
				},
				{
					name: 'Input focus',
					bg: 'var(--color-input-bg)',
					fg: 'var(--color-body)',
					border: 'var(--color-primary)',
					usage: 'Input :focus',
				},
				{
					name: 'Input error',
					bg: 'var(--color-input-bg)',
					fg: 'var(--color-body)',
					border: 'var(--color-error)',
					usage: 'Input :invalid',
				},
				{
					name: 'Input disabled',
					bg: 'var(--color-subtle)',
					fg: 'var(--color-muted)',
					border: 'var(--color-border)',
					usage: 'Input :disabled',
				},
			],
		},
	];
</script>

<section class="section">
	<div class="demos">
		<!-- Typography -->
		<div id="tok-typography" class="scroll-target">
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
		</div>

		<!-- Spacing -->
		<div id="tok-spacing" class="scroll-target">
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
		</div>

		<!-- Colors -->
		<div id="tok-colors" class="scroll-target">
		<DemoCard title="Colors" description="Semantic color tokens (toggle theme to see dark mode)">
			<div class="color-section">
				<p class="color-note">Single source of truth: <code>src/app.css</code></p>
				{#each colorGroups as group}
					<h4 class="color-group-label">{group.label}</h4>
					<div class="token-grid">
						{#each group.tokens as token}
							<div class="color-swatch">
								<div class="color-preview" style="background: var({token.var});"></div>
								<div class="color-info">
									<div class="color-name">{token.name}</div>
									<div class="color-var">{token.var}</div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Color Combos -->
		<div id="tok-color-combos" class="scroll-target">
		<DemoCard title="Color Combos" description="How color tokens pair in real components — bg + fg + border">
			<div class="combos-section">
				{#each colorCombos as group}
					<h4 class="color-group-label">{group.label}</h4>
					<div class="combos-grid">
						{#each group.combos as combo}
							<div
								class="combo-card"
								style="background: {combo.bg}; border-left-color: {combo.border ?? 'var(--color-border)'};"
							>
								<div class="combo-sample" style="color: {combo.fg};">
									{combo.name}
								</div>
								<div class="combo-meta" style="color: color-mix(in srgb, {combo.fg} 70%, transparent);">
									{combo.usage}
								</div>
								<div class="combo-vars" style="color: color-mix(in srgb, {combo.fg} 55%, transparent);">
									{combo.bg} + {combo.fg}
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Z-Index -->
		<div id="tok-z-index" class="scroll-target">
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
		</div>

		<!-- Surfaces -->
		<div id="tok-surfaces" class="scroll-target">
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
		</div>

		<!-- Border Radius -->
		<div id="tok-radius" class="scroll-target">
		<DemoCard title="Border Radius" description="Corner rounding values">
			<div class="token-grid">
				{#each Object.entries(borderRadius) as [key, value]}
					<TokenSwatch label={key} {value} preview="radius" />
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Shadows -->
		<div id="tok-shadows" class="scroll-target">
		<DemoCard title="Box Shadows" description="Elevation and depth">
			<div class="token-grid">
				{#each Object.entries(boxShadow) as [key, value]}
					<TokenSwatch label={key} {value} preview="shadow" />
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Icon Sizes -->
		<div id="tok-icons" class="scroll-target">
		<DemoCard title="Icon Sizes" description="Standard sizes for UnoCSS preset-icons (text-icon-*)">
			<div class="token-grid">
				{#each Object.entries(iconSize) as [key, value]}
					<div class="icon-sample">
						<div class="icon-preview" style="width: {value}; height: {value};"></div>
						<div class="spacing-info">
							<div class="spacing-key">{key}</div>
							<div class="spacing-value">{value}</div>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Breakpoints -->
		<div id="tok-breakpoints" class="scroll-target">
		<DemoCard title="Breakpoints" description="Media query breakpoints (min-width)">
			<div class="breakpoint-list">
				{#each Object.entries(breakpoints) as [key, value]}
					<div class="breakpoint-sample">
						<div class="breakpoint-bar" style="width: calc({value} / 15.36);"></div>
						<div class="breakpoint-info">
							<span class="spacing-key">{key}</span>
							<span class="spacing-value">{value}</span>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Container Queries -->
		<div id="tok-containers" class="scroll-target">
		<DemoCard title="Container Queries" description="Container query breakpoints">
			<div class="breakpoint-list">
				{#each Object.entries(containers) as [key, value]}
					<div class="breakpoint-sample">
						<div class="breakpoint-bar" style="width: calc({value} / 5.76);"></div>
						<div class="breakpoint-info">
							<span class="spacing-key">{key}</span>
							<span class="spacing-value">{value}</span>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Duration -->
		<div id="tok-duration" class="scroll-target">
		<DemoCard title="Animation Duration" description="Transition and animation timing">
			<div class="duration-list">
				{#each Object.entries(duration) as [key, value]}
					<div class="duration-sample">
						<div class="duration-bar-track">
							<div
								class="duration-bar-fill"
								style="animation-duration: {value};"
							></div>
						</div>
						<div class="breakpoint-info">
							<span class="spacing-key">{key}</span>
							<span class="spacing-value">{value}</span>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>

		<!-- Layout -->
		<div id="tok-layout" class="scroll-target">
		<DemoCard title="Layout" description="Content width constraints and sidebar dimensions">
			<h4 class="color-group-label">Content widths</h4>
			<div class="layout-list">
				{#each Object.entries(layout) as [key, value]}
					<div class="layout-sample">
						<div class="layout-bar" style="max-width: {value};"></div>
						<div class="breakpoint-info">
							<span class="spacing-key">{key}</span>
							<span class="spacing-value">{value}</span>
						</div>
					</div>
				{/each}
			</div>
			<h4 class="color-group-label">Sidebar</h4>
			<div class="layout-list">
				{#each Object.entries(sidebar) as [key, value]}
					<div class="layout-sample">
						<div class="layout-bar" style="max-width: {value};"></div>
						<div class="breakpoint-info">
							<span class="spacing-key">{key}</span>
							<span class="spacing-value">{value}</span>
						</div>
					</div>
				{/each}
			</div>
		</DemoCard>
		</div>
	</div>
</section>

<style>
	.section {
		margin-bottom: var(--spacing-8);
	}

	.scroll-target {
		scroll-margin-top: 3rem;
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

	.color-group-label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		margin: var(--spacing-4) 0 var(--spacing-2) 0;
	}

	.color-group-label:first-child {
		margin-top: 0;
	}

	.combos-section {
		width: 100%;
	}

	.combos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.combo-card {
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-height: 5rem;
	}

	.combo-sample {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		line-height: 1.3;
	}

	.combo-meta {
		font-size: var(--text-fluid-xs);
		font-family: 'Fira Code', monospace;
		line-height: 1.3;
	}

	.combo-vars {
		font-size: 0.65rem;
		font-family: 'Fira Code', monospace;
		line-height: 1.2;
		word-break: break-all;
	}

	.icon-sample {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.icon-preview {
		background: var(--color-primary);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.breakpoint-list,
	.duration-list,
	.layout-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.breakpoint-sample {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.breakpoint-bar {
		height: 0.5rem;
		background: var(--color-primary);
		border-radius: var(--radius-full);
		flex-shrink: 0;
		min-width: 1rem;
	}

	.breakpoint-info {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
	}

	.duration-sample {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.duration-bar-track {
		width: 6rem;
		height: 0.5rem;
		background: var(--color-subtle);
		border-radius: var(--radius-full);
		overflow: hidden;
		flex-shrink: 0;
	}

	.duration-bar-fill {
		height: 100%;
		width: 100%;
		background: var(--color-primary);
		border-radius: var(--radius-full);
		animation-name: duration-sweep;
		animation-iteration-count: infinite;
		animation-timing-function: ease-in-out;
	}

	@keyframes duration-sweep {
		0% { transform: translateX(-100%); }
		50% { transform: translateX(0); }
		100% { transform: translateX(-100%); }
	}

	.layout-sample {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.layout-bar {
		height: 0.5rem;
		width: 100%;
		background: var(--color-primary);
		border-radius: var(--radius-full);
		flex-shrink: 1;
	}

	@media (max-width: 640px) {
		.token-grid,
		.surface-grid,
		.combos-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
