<script lang="ts">
import type { ToggleablePart } from '$lib/config/customization';

interface Props {
	parts: ToggleablePart[];
	visibility: Record<string, boolean>;
	ontoggle: (partId: string, visible: boolean) => void;
}

let { parts, visibility, ontoggle }: Props = $props();
</script>

<fieldset class="toggle-list">
	<legend class="toggle-label">Parts</legend>
	<div class="toggle-items">
		{#each parts as part (part.id)}
			{@const visible = visibility[part.id] ?? part.defaultVisible}
			<button
				class="toggle-item"
				class:active={visible}
				aria-pressed={visible}
				onclick={() => ontoggle(part.id, !visible)}
			>
				<span
					class={visible ? 'i-lucide-eye' : 'i-lucide-eye-off'}
					aria-hidden="true"
				></span>
				<span>{part.label}</span>
			</button>
		{/each}
	</div>
</fieldset>

<style>
	.toggle-list {
		border: none;
		padding: 0;
		margin: 0;
	}

	.toggle-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-2);
	}

	.toggle-items {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.toggle-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border: none;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-fg) 5%, transparent);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: background var(--duration-fast), color var(--duration-fast);
	}

	.toggle-item:hover {
		background: color-mix(in srgb, var(--color-fg) 10%, transparent);
	}

	.toggle-item.active {
		color: var(--color-fg);
	}

	.toggle-item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
