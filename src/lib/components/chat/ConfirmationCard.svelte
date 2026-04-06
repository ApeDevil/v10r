<script lang="ts">
	interface Props {
		description: string;
		onconfirm: () => void;
		onskip: () => void;
	}

	let { description, onconfirm, onskip }: Props = $props();
</script>

<div class="confirm-card" role="alert">
	<div class="confirm-icon">
		<span class="i-lucide-alert-triangle"></span>
	</div>
	<div class="confirm-body">
		<p class="confirm-description">{description}</p>
		<div class="confirm-actions">
			<button type="button" class="confirm-btn confirm-allow" onclick={onconfirm}>
				Allow
			</button>
			<button type="button" class="confirm-btn confirm-skip" onclick={onskip}>
				Skip
			</button>
		</div>
	</div>
</div>

<style>
	.confirm-card {
		display: flex;
		gap: 8px;
		padding: 10px 12px;
		border-radius: var(--radius-md, 6px);
		border: 1px solid color-mix(in srgb, var(--color-error-fg, #ef4444) 25%, transparent);
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 6%, transparent);
		font-size: 12px;
	}

	.confirm-icon {
		flex-shrink: 0;
		color: var(--color-error-fg, #ef4444);
		font-size: 16px;
		line-height: 1;
		padding-top: 1px;
	}

	.confirm-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	}

	.confirm-description {
		color: var(--color-fg);
		line-height: 1.4;
		margin: 0;
	}

	.confirm-actions {
		display: flex;
		gap: 6px;
	}

	.confirm-btn {
		padding: 3px 10px;
		border-radius: var(--radius-sm, 4px);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.confirm-allow {
		background: var(--color-primary);
		color: white;
	}

	.confirm-allow:hover {
		opacity: 0.9;
	}

	.confirm-skip {
		background: transparent;
		color: var(--color-muted);
		border-color: var(--color-border);
	}

	.confirm-skip:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
