<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	motif?: 'none' | 'dot' | 'diamond' | 'crosshair' | 'flourish';
	width?: 'full' | 'content' | 'narrow';
	color?: string;
	opacity?: number;
	class?: string;
}

let { motif = 'none', width = 'full', color = 'currentColor', opacity = 0.2, class: className }: Props = $props();

const widths: Record<string, string> = {
	full: 'w-full',
	content: 'w-3/4',
	narrow: 'w-1/2',
};
</script>

<div
	role="separator"
	class={cn('flex items-center', widths[width], className)}
	aria-hidden="true"
>
	<div class="divider-line flex-1" style:background-color={color} style:opacity></div>

	{#if motif !== 'none'}
		<div class="divider-motif">
			{#if motif === 'dot'}
				<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
					<circle cx="4" cy="4" r="3" fill={color} fill-opacity={opacity} />
				</svg>
			{:else if motif === 'diamond'}
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<polygon points="5,0.5 9.5,5 5,9.5 0.5,5" fill={color} fill-opacity={opacity} />
				</svg>
			{:else if motif === 'crosshair'}
				<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
					<line x1="0" y1="8" x2="16" y2="8" stroke={color} stroke-opacity={opacity} />
					<line x1="8" y1="0" x2="8" y2="16" stroke={color} stroke-opacity={opacity} />
					<circle cx="8" cy="8" r="3" fill="none" stroke={color} stroke-opacity={opacity} />
				</svg>
			{:else if motif === 'flourish'}
				<svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
					<path
						d="M0,6 Q6,0 12,6 Q18,12 24,6"
						fill="none"
						stroke={color}
						stroke-opacity={opacity}
						stroke-width="1.5"
					/>
				</svg>
			{/if}
		</div>

		<div class="divider-line flex-1" style:background-color={color} style:opacity></div>
	{/if}
</div>

<style>
	.divider-line {
		height: 1px;
	}

	.divider-motif {
		padding: 0 var(--spacing-3);
		display: flex;
		align-items: center;
	}

	@media (forced-colors: active) {
		svg {
			forced-color-adjust: auto;
		}
	}
</style>
