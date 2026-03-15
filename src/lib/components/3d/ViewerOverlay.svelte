<script lang="ts">
	import type { Model3D } from '$lib/config/models';

	interface Props {
		model: Model3D;
		currentAnimation: string;
		onanimationchange?: (clip: string) => void;
		action: import('svelte').Snippet;
	}

	let { model, currentAnimation, onanimationchange, action }: Props = $props();
</script>

<div class="overlay">
	<div class="command-surface">
		{@render action()}
		<span class="divider" aria-hidden="true"></span>
		<span class="model-label">{model.name}</span>

		{#if model.animations}
			<span class="divider" aria-hidden="true"></span>
			<div class="clip-track" role="group" aria-label="Animation">
				{#each model.animations.clips as anim}
					<button
						class="clip-btn"
						class:active={currentAnimation === anim}
						aria-pressed={currentAnimation === anim}
						onclick={() => onanimationchange?.(anim)}
					>
						{anim}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		padding: var(--spacing-6) var(--spacing-5) var(--spacing-5);
		z-index: 1;
	}

	.command-surface {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		background: color-mix(in srgb, var(--color-bg) 85%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		pointer-events: auto;
		width: fit-content;
		font-size: var(--text-fluid-sm);
	}

	/* Action element (button or link) — interactive zone within the surface */
	.command-surface > :global(button),
	.command-surface > :global(a) {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-1) var(--spacing-2);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--color-fg);
		font-size: inherit;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: background var(--duration-fast);
		user-select: none;
	}

	.command-surface > :global(button:hover),
	.command-surface > :global(a:hover) {
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.command-surface > :global(button:focus-visible),
	.command-surface > :global(a:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.command-surface :global(.esc-hint) {
		font-family: inherit;
		font-size: 0.75em;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		padding: 1px 4px;
		line-height: 1.4;
	}

	@media (pointer: coarse) {
		.command-surface :global(.esc-hint) {
			display: none;
		}
	}

	.divider {
		width: 1px;
		height: 1em;
		background: var(--color-border);
		flex-shrink: 0;
	}

	.model-label {
		font-weight: 400;
		color: var(--color-muted);
		max-width: 20ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Toggle group track — inset container for animation clips */
	.clip-track {
		display: flex;
		align-items: center;
		gap: 2px;
		background: color-mix(in srgb, var(--color-fg) 6%, transparent);
		border-radius: var(--radius-full);
		padding: 2px;
	}

	.clip-btn {
		padding: var(--spacing-1) var(--spacing-3);
		font-size: inherit;
		font-weight: 400;
		color: var(--color-muted);
		white-space: nowrap;
		border-radius: var(--radius-full);
		border: none;
		background: transparent;
		cursor: pointer;
		user-select: none;
	}

	.clip-btn:not(.active):hover {
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
		color: var(--color-fg);
	}

	.clip-btn.active {
		background: color-mix(in srgb, var(--color-primary) 90%, transparent);
		color: var(--color-on-primary);
		font-weight: 500;
	}

	.clip-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
