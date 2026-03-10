<script lang="ts">
import { Typography } from '$lib/components';
import type { TypographyVariants } from '$lib/components/primitives/typography/typography';
import type { FontLoadState } from '$lib/utils/fonts';

type Variant = NonNullable<TypographyVariants['variant']>;

interface Props {
	mode: 'single' | 'pairing';
	fontStack: string;
	headingFontStack: string;
	bodyFontStack: string;
	loadState: FontLoadState;
	headingLoadState: FontLoadState;
	bodyLoadState: FontLoadState;
}

let { mode, fontStack, headingFontStack, bodyFontStack, loadState, headingLoadState, bodyLoadState }: Props = $props();

let customText = $state('');

const defaultSamples: { variant: Variant; text: string; role: 'heading' | 'body' | 'code' }[] = [
	{ variant: 'h1', text: 'Heading 1', role: 'heading' },
	{ variant: 'h2', text: 'Heading 2', role: 'heading' },
	{ variant: 'h3', text: 'Heading 3', role: 'heading' },
	{ variant: 'h4', text: 'Heading 4', role: 'heading' },
	{
		variant: 'body',
		text: 'Body text — The quick brown fox jumps over the lazy dog. Typography is the art and technique of arranging type to make written language legible, readable, and appealing.',
		role: 'body',
	},
	{ variant: 'lead', text: 'Lead text for introductions and summaries.', role: 'body' },
	{ variant: 'muted', text: 'Muted secondary text for captions and metadata.', role: 'body' },
	{ variant: 'code', text: 'const font = await loadFont("Inter");', role: 'code' },
];

function getFontFamily(role: 'heading' | 'body' | 'code'): string | undefined {
	if (mode === 'single') return undefined; // handled by parent container
	if (role === 'code') return undefined; // stays monospace
	return role === 'heading' ? headingFontStack : bodyFontStack;
}

function getLabel(variant: string, role: 'heading' | 'body' | 'code'): string {
	if (mode === 'single') return variant;
	if (role === 'code') return variant;
	return `${variant} (${role})`;
}

function isRoleLoading(role: 'heading' | 'body' | 'code'): boolean {
	if (mode === 'single') return loadState === 'loading';
	if (role === 'heading') return headingLoadState === 'loading';
	if (role === 'body') return bodyLoadState === 'loading';
	return false;
}
</script>

<div class="preview" style:font-family={mode === 'single' ? fontStack : undefined}>
	{#if customText.trim()}
		<div class="custom-preview">
			<div style:font-family={mode === 'pairing' ? headingFontStack : undefined}>
				<Typography variant="h1">{customText}</Typography>
			</div>
			<div style:font-family={mode === 'pairing' ? headingFontStack : undefined}>
				<Typography variant="h3">{customText}</Typography>
			</div>
			<div style:font-family={mode === 'pairing' ? bodyFontStack : undefined}>
				<Typography variant="body">{customText}</Typography>
			</div>
		</div>
	{:else}
		<div class="variant-list">
			{#each defaultSamples as sample}
				{@const roleFontFamily = getFontFamily(sample.role)}
				<div
					class="variant-row"
					class:loading={isRoleLoading(sample.role)}
					style:font-family={roleFontFamily}
				>
					<span class="variant-label">{getLabel(sample.variant, sample.role)}</span>
					<div class="variant-sample">
						<Typography variant={sample.variant}>{sample.text}</Typography>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="custom-input-wrap">
	<input
		type="text"
		class="custom-input"
		placeholder="Type custom text to preview..."
		bind:value={customText}
	/>
	{#if customText}
		<button class="clear-btn" onclick={() => (customText = '')}>Clear</button>
	{/if}
</div>

<style>
	.preview {
		min-height: 200px;
	}

	.variant-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.variant-row {
		display: flex;
		gap: var(--spacing-5);
		align-items: baseline;
		transition: opacity var(--duration-fast);
	}

	.variant-row.loading {
		opacity: 0.5;
	}

	.variant-label {
		flex-shrink: 0;
		width: 7rem;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-family: system-ui, sans-serif;
		text-align: right;
	}

	.variant-sample {
		flex: 1;
		min-width: 0;
	}

	.custom-preview {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.custom-input-wrap {
		margin-top: var(--spacing-5);
		display: flex;
		gap: var(--spacing-3);
	}

	.custom-input {
		flex: 1;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-0);
		color: var(--color-fg);
		font-size: var(--text-fluid-base);
		outline: none;
		transition: border-color var(--duration-fast);
	}

	.custom-input::placeholder {
		color: var(--color-muted);
	}

	.custom-input:focus {
		border-color: var(--color-primary);
	}

	.clear-btn {
		flex-shrink: 0;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: color var(--duration-fast), border-color var(--duration-fast);
	}

	.clear-btn:hover {
		color: var(--color-fg);
		border-color: var(--color-fg);
	}

	/* Code variant should stay monospace regardless of selected font */
	.preview :global(code) {
		font-family: 'Fira Code', 'Courier New', monospace !important;
	}

	@media (max-width: 640px) {
		.variant-row {
			flex-direction: column;
			gap: var(--spacing-1);
		}

		.variant-label {
			width: auto;
			text-align: left;
		}
	}
</style>
