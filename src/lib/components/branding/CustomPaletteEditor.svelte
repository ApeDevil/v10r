<script lang="ts">
import ContrastBadge from '$lib/components/ui/ContrastBadge.svelte';
import OklchColorInput from '$lib/components/ui/OklchColorInput.svelte';
import type { PaletteColors } from '$lib/styles/random/types';

interface Props {
	palette: PaletteColors;
	otherMode: PaletteColors;
	mode: 'light' | 'dark';
	onchange?: (token: string, value: string) => void;
}

let { palette, otherMode, mode, onchange }: Props = $props();

function handleChange(token: string, value: string) {
	onchange?.(token, value);
}
</script>

<div class="editor">
	<!-- Base Section (open by default) -->
	<details open>
		<summary class="section-header">
			<span class="section-title">Base</span>
			<span class="section-hint">bg, fg, text, borders</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="bg"
				bind:value={palette.bg}
				onchange={(v) => handleChange('bg', v)}
			/>
			<div class="token-with-badge">
				<OklchColorInput
					label="fg"
					bind:value={palette.fg}
					onchange={(v) => handleChange('fg', v)}
				/>
				<ContrastBadge fgColor={palette.fg} bgColor={palette.bg} />
			</div>
			<div class="token-with-badge">
				<OklchColorInput
					label="heading"
					bind:value={palette.heading}
					onchange={(v) => handleChange('heading', v)}
				/>
				<ContrastBadge fgColor={palette.heading} bgColor={palette.bg} />
			</div>
			<div class="token-with-badge">
				<OklchColorInput
					label="body"
					bind:value={palette.body}
					onchange={(v) => handleChange('body', v)}
				/>
				<ContrastBadge fgColor={palette.body} bgColor={palette.bg} />
			</div>
			<div class="token-with-badge">
				<OklchColorInput
					label="muted"
					bind:value={palette.muted}
					onchange={(v) => handleChange('muted', v)}
				/>
				<ContrastBadge fgColor={palette.muted} bgColor={palette.bg} />
			</div>
			<OklchColorInput
				label="border"
				bind:value={palette.border}
				onchange={(v) => handleChange('border', v)}
			/>
			<OklchColorInput
				label="subtle"
				bind:value={palette.subtle}
				onchange={(v) => handleChange('subtle', v)}
			/>
		</div>
	</details>

	<!-- Primary Section -->
	<details>
		<summary class="section-header">
			<span class="section-title">Primary</span>
			<span class="section-hint">primary action colors</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="primary"
				bind:value={palette.primary}
				onchange={(v) => handleChange('primary', v)}
			/>
			<OklchColorInput
				label="primary-hover"
				bind:value={palette['primary-hover']}
				onchange={(v) => handleChange('primary-hover', v)}
			/>
			<OklchColorInput
				label="primary-container"
				bind:value={palette['primary-container']}
				onchange={(v) => handleChange('primary-container', v)}
			/>
			<div class="token-with-badge">
				<OklchColorInput
					label="on-primary-container"
					bind:value={palette['on-primary-container']}
					onchange={(v) => handleChange('on-primary-container', v)}
				/>
				<ContrastBadge
					fgColor={palette['on-primary-container']}
					bgColor={palette['primary-container']}
				/>
			</div>
			<OklchColorInput
				label="primary-dim"
				bind:value={palette['primary-dim']}
				onchange={(v) => handleChange('primary-dim', v)}
			/>
			<div class="token-with-badge">
				<OklchColorInput
					label="on-primary"
					bind:value={palette['on-primary']}
					onchange={(v) => handleChange('on-primary', v)}
				/>
				<ContrastBadge fgColor={palette['on-primary']} bgColor={palette.primary} />
			</div>
		</div>
	</details>

	<!-- Secondary Section -->
	<details>
		<summary class="section-header">
			<span class="section-title">Secondary</span>
			<span class="section-hint">secondary action colors</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="secondary"
				bind:value={palette.secondary}
				onchange={(v) => handleChange('secondary', v)}
			/>
			<div class="token-with-badge">
				<OklchColorInput
					label="on-secondary"
					bind:value={palette['on-secondary']}
					onchange={(v) => handleChange('on-secondary', v)}
				/>
				<ContrastBadge fgColor={palette['on-secondary']} bgColor={palette.secondary} />
			</div>
		</div>
	</details>

	<!-- Accent Section -->
	<details>
		<summary class="section-header">
			<span class="section-title">Accent</span>
			<span class="section-hint">secondary navigation, sublinks, badges</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="accent"
				bind:value={palette.accent}
				onchange={(v) => handleChange('accent', v)}
			/>
			<OklchColorInput
				label="accent-hover"
				bind:value={palette['accent-hover']}
				onchange={(v) => handleChange('accent-hover', v)}
			/>
			<OklchColorInput
				label="accent-container"
				bind:value={palette['accent-container']}
				onchange={(v) => handleChange('accent-container', v)}
			/>
			<div class="token-with-badge">
				<OklchColorInput
					label="on-accent"
					bind:value={palette['on-accent']}
					onchange={(v) => handleChange('on-accent', v)}
				/>
				<ContrastBadge fgColor={palette['on-accent'] ?? ''} bgColor={palette.accent ?? ''} />
			</div>
			<div class="token-with-badge">
				<OklchColorInput
					label="on-accent-container"
					bind:value={palette['on-accent-container']}
					onchange={(v) => handleChange('on-accent-container', v)}
				/>
				<ContrastBadge
					fgColor={palette['on-accent-container'] ?? ''}
					bgColor={palette['accent-container'] ?? ''}
				/>
			</div>
		</div>
	</details>

	<!-- Input Section -->
	<details>
		<summary class="section-header">
			<span class="section-title">Input</span>
			<span class="section-hint">form field backgrounds and borders</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="input"
				bind:value={palette.input}
				onchange={(v) => handleChange('input', v)}
			/>
			<OklchColorInput
				label="input-border"
				bind:value={palette['input-border']}
				onchange={(v) => handleChange('input-border', v)}
			/>
		</div>
	</details>

	<!-- Surfaces Section -->
	<details>
		<summary class="section-header">
			<span class="section-title">Surfaces</span>
			<span class="section-hint">layered surface elevations</span>
		</summary>
		<div class="section-body">
			<OklchColorInput
				label="surface-1"
				bind:value={palette['surface-1']}
				onchange={(v) => handleChange('surface-1', v)}
			/>
			<OklchColorInput
				label="surface-2"
				bind:value={palette['surface-2']}
				onchange={(v) => handleChange('surface-2', v)}
			/>
			<OklchColorInput
				label="surface-3"
				bind:value={palette['surface-3']}
				onchange={(v) => handleChange('surface-3', v)}
			/>
		</div>
	</details>
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	details {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		cursor: pointer;
		list-style: none;
		background: var(--color-surface-1);
		user-select: none;
	}

	.section-header::-webkit-details-marker {
		display: none;
	}

	.section-header::before {
		content: '';
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-right: 1.5px solid var(--color-muted);
		border-bottom: 1.5px solid var(--color-muted);
		transform: rotate(-45deg);
		transition: transform var(--duration-fast) ease;
		flex-shrink: 0;
		margin-right: 0.125rem;
	}

	details[open] .section-header::before {
		transform: rotate(45deg);
	}

	.section-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.section-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.section-body {
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
	}

	.token-with-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.token-with-badge > :global(.oklch-input) {
		flex: 1;
		min-width: 0;
	}
</style>
