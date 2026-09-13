<script lang="ts">
/**
 * One row per tool call the assistant makes — what it is doing while the user waits, and
 * whether it worked. `phase` is the UI vocabulary; the mapping from the SDK's tool-part
 * `state` lives in ChatMessage, the label in `tool-label.ts`.
 */
interface Props {
	/** The tool's localized label (`toolLabel()` — the manifest's one human label). */
	label: string;
	/** Not named `state` — that collides with the `$state` rune. */
	phase: 'pending' | 'running' | 'done' | 'error';
	/** The tool's output; a `done` call whose output carries an `error` envelope failed too. */
	output?: unknown;
}

let { label, phase, output }: Props = $props();

const failed = $derived(
	phase === 'error' || (phase === 'done' && output != null && typeof output === 'object' && 'error' in output),
);
</script>

<div class="tool-status">
	{#if phase === 'pending' || phase === 'running'}
		<span class="i-lucide-loader-2 tool-icon tool-spin"></span>
		<span class="tool-label">{label}...</span>
	{:else if failed}
		<span class="i-lucide-alert-circle tool-icon tool-error"></span>
		<span class="tool-label tool-error">{label} failed</span>
	{:else}
		<span class="i-lucide-check-circle tool-icon tool-success"></span>
		<span class="tool-label">{label}</span>
	{/if}
</div>

<style>
	.tool-status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: var(--radius-sm, 4px);
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		font-size: 12px;
	}

	.tool-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.tool-spin {
		color: var(--color-muted);
		animation: spin 1s linear infinite;
	}

	.tool-error {
		color: var(--color-error-fg);
	}

	.tool-success {
		color: var(--color-primary);
	}

	.tool-label {
		color: var(--color-muted);
		font-style: italic;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
