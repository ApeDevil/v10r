<script lang="ts">
	import type { AttachmentPoint } from '$lib/config/customization';

	interface Props {
		points: AttachmentPoint[];
		enabled: Record<string, boolean>;
		disabledIds?: Set<string>;
		ontoggle: (accessoryId: string, active: boolean) => void;
	}

	let { points, enabled, disabledIds, ontoggle }: Props = $props();
</script>

{#each points as point (point.id)}
	<fieldset class="attachment-group">
		<legend class="group-label">{point.label}</legend>
		<div class="accessory-items">
			{#each point.accessories as acc (acc.id)}
				{@const isActive = enabled[acc.id] ?? false}
				{@const isDisabled = disabledIds?.has(acc.id) ?? false}
				<label class="accessory-toggle" class:disabled={isDisabled}>
					<input
						type="checkbox"
						checked={isActive}
						disabled={isDisabled}
						onchange={(e) => ontoggle(acc.id, (e.currentTarget as HTMLInputElement).checked)}
						class="sr-only"
					/>
					<span class="toggle-track" class:active={isActive}>
						<span class="toggle-thumb"></span>
					</span>
					<span class="accessory-label">{acc.label}</span>
					<span class="accessory-swatch" style:background-color={acc.color}></span>
				</label>
			{/each}
		</div>
	</fieldset>
{/each}

<style>
	.attachment-group {
		border: none;
		padding: 0;
		margin: 0;
	}

	.group-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-2);
	}

	.accessory-items {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.accessory-toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		cursor: pointer;
		padding: var(--spacing-1) 0;
	}

	.accessory-toggle.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.toggle-track {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-fg) 20%, transparent);
		transition: background var(--duration-fast);
		flex-shrink: 0;
	}

	.toggle-track.active {
		background: var(--color-primary);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-full);
		background: white;
		transition: transform var(--duration-fast);
	}

	.toggle-track.active .toggle-thumb {
		transform: translateX(16px);
	}

	.accessory-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		flex: 1;
	}

	.accessory-swatch {
		width: 16px;
		height: 16px;
		border-radius: var(--radius-full);
		border: 1px solid color-mix(in srgb, var(--color-fg) 15%, transparent);
		flex-shrink: 0;
	}
</style>
