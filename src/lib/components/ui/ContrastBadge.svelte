<script lang="ts">
import { contrastRatio } from '$lib/styles/random/contrast';

interface Props {
	fgColor: string;
	bgColor: string;
	level?: 'AA' | 'AAA';
}

let {
	fgColor,
	bgColor,
	level = 'AA',
}: Props = $props();

const ratio = $derived.by(() => {
	try {
		return contrastRatio(fgColor, bgColor);
	} catch {
		return null;
	}
});

const thresholds = $derived({
	aa: level === 'AAA' ? 7 : 4.5,
	large: level === 'AAA' ? 4.5 : 3,
});

const status = $derived(
	ratio === null
		? 'error'
		: ratio >= thresholds.aa
			? 'pass'
			: ratio >= thresholds.large
				? 'large'
				: 'fail'
);

const ratioLabel = $derived(ratio !== null ? `${ratio.toFixed(1)}:1` : '--');
</script>

<span class="badge" data-status={status}>
	<span class="ratio font-mono text-fluid-xs">{ratioLabel}</span>
	{#if status === 'pass'}
		<span class="i-lucide-check icon" aria-label="Passes {level}"></span>
	{:else if status === 'large'}
		<span class="i-lucide-minus icon" aria-label="Passes large text only"></span>
	{:else if status === 'fail'}
		<span class="i-lucide-x icon" aria-label="Fails {level}"></span>
	{:else}
		<span class="i-lucide-help-circle icon" aria-label="Unable to compute"></span>
	{/if}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--text-fluid-xs);
	}

	.ratio {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: var(--text-fluid-xs);
	}

	.icon {
		width: 0.875em;
		height: 0.875em;
		flex-shrink: 0;
	}

	/* Status colours — avoid UnoCSS text-success/warning/error with CSS vars,
	   apply directly to dodge the opacity modifier issue */
	.badge[data-status='pass'] {
		color: var(--color-success);
	}

	.badge[data-status='large'] {
		color: var(--color-warning);
	}

	.badge[data-status='fail'] {
		color: var(--color-error);
	}

	.badge[data-status='error'] {
		color: var(--color-muted);
	}
</style>
