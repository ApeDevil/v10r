<script lang="ts">
interface Props {
	visible: boolean;
	ondismiss: () => void;
}

let { visible, ondismiss }: Props = $props();
</script>

{#if visible}
	<div class="banner" role="alert">
		<span class="i-lucide-wand-2 icon" aria-hidden="true"></span>
		<p class="message">Primary changed — adjust hover, container, and dim colors below to match.</p>
		<div class="actions">
			<button type="button" class="btn-dismiss" onclick={ondismiss}>Got it</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		background: var(--color-primary-container);
		color: var(--color-on-primary-container);
		border: 1px solid var(--color-primary-dim);
	}

	.icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		color: var(--color-primary);
	}

	.message {
		flex: 1;
		font-size: var(--text-fluid-sm);
		color: var(--color-on-primary-container);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.btn-dismiss {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--color-primary-dim);
		background: transparent;
		color: var(--color-on-primary-container);
		transition: background-color var(--duration-fast) ease;
	}

	.btn-dismiss:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}
</style>
