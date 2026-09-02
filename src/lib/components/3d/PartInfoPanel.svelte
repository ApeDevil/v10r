<script lang="ts">
import type { PartDef } from '$lib/3d/parts';
import PartPhotoGallery from './PartPhotoGallery.svelte';

interface Props {
	/** The selected part shown in the panel */
	part: PartDef;
	/** Link to the customizer page (shown when the part hints at customization) */
	customizeHref?: string;
	/** Close the panel (deselects the part) */
	onclose: () => void;
}

let { part, customizeHref, onclose }: Props = $props();
</script>

<!-- Non-modal on purpose: the 3D scene stays orbitable and other parts stay
     clickable while the panel is open (a modal drawer would scrim the canvas). -->
<aside class="panel" aria-label="{part.label} details">
	<div class="panel-header">
		<h2>{part.label}</h2>
		<button type="button" class="close-btn" onclick={onclose} aria-label="Close part details">
			<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
		</button>
	</div>

	<div class="panel-body" aria-live="polite">
		<p>{part.description}</p>

		{#if part.photos?.length}
			<PartPhotoGallery photos={part.photos} partLabel={part.label} />
		{/if}

		{#if part.customizeHint && customizeHref}
			<a class="customize-link" href={customizeHref}>
				<span class="i-lucide-sliders-horizontal h-4 w-4" aria-hidden="true"></span>
				<span>Customize colours</span>
			</a>
		{/if}
	</div>
</aside>

<style>
	.panel {
		position: absolute;
		top: var(--spacing-5);
		right: var(--spacing-5);
		bottom: var(--spacing-5);
		z-index: 2;
		display: flex;
		flex-direction: column;
		width: min(21rem, calc(100vw - 2 * var(--spacing-5)));
		background: color-mix(in srgb, var(--color-bg) 88%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		pointer-events: auto;
		animation: panel-in var(--duration-normal) ease-out;
	}

	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateX(var(--spacing-4));
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.panel-header h2 {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-1);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-fg);
		opacity: 0.7;
		cursor: pointer;
		transition: opacity var(--duration-fast);
	}

	.close-btn:hover {
		opacity: 1;
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.panel-body {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-4);
		overflow-y: auto;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.panel-body p {
		margin: 0;
	}

	.customize-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		align-self: flex-start;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}

	.customize-link:hover {
		text-decoration: underline;
	}

	/* Bottom sheet on small viewports */
	@media (max-width: 767px) {
		.panel {
			top: auto;
			left: var(--spacing-3);
			right: var(--spacing-3);
			bottom: var(--spacing-3);
			width: auto;
			max-height: 55svh;
		}

		@keyframes panel-in {
			from {
				opacity: 0;
				transform: translateY(var(--spacing-4));
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}
</style>
