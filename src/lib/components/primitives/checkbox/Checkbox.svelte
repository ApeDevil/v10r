<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import { cn } from '$lib/utils/cn';

interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked'> {
	checked?: boolean;
	label?: string;
	class?: string;
}

let { checked = $bindable(false), label, class: className, ...restProps }: Props = $props();

// Generate unique ID for label association
const id = crypto.randomUUID();
</script>

<div class={cn('checkbox-container flex items-center gap-2', className)}>
	<div class="relative">
		<input
			{id}
			type="checkbox"
			bind:checked
			class="peer sr-only"
			{...restProps}
		/>
		<label
			for={id}
			class={cn(
				'checkbox-box flex h-5 w-5 shrink-0 items-center justify-center rounded cursor-pointer',
				'bg-subtle border-2 border-input-border',
				'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-1',
				'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
				'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-white'
			)}
		>
			{#if checked}
				<span class="i-lucide-check h-4 w-4" ></span>
			{/if}
		</label>
	</div>
	{#if label}
		<label
			for={id}
			class={cn('checkbox-label text-fluid-sm text-fg cursor-pointer select-none', {
				'opacity-50 cursor-not-allowed': restProps.disabled
			})}
		>
			{label}
		</label>
	{/if}
</div>

<style>
	/* Hover on container (box or label) → highlight checkbox box */
	.checkbox-container:hover :global(.checkbox-box) {
		border-color: color-mix(in srgb, var(--color-fg) 70%, transparent);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
		outline: 1px solid color-mix(in srgb, var(--color-fg) 25%, transparent);
		outline-offset: 1px;
	}

	/* Hover: underline label */
	.checkbox-container:hover :global(.checkbox-label) {
		text-decoration: underline;
	}

	/* Disabled: suppress hover */
	.checkbox-container:has(input:disabled):hover :global(.checkbox-box) {
		border-color: var(--color-input-border);
		background: var(--color-subtle);
		outline: none;
	}

	.checkbox-container:has(input:disabled):hover :global(.checkbox-label) {
		text-decoration: none;
	}

	/* Checked: keep primary colors on hover */
	.checkbox-container:has(input:checked):hover :global(.checkbox-box) {
		border-color: var(--color-primary);
		background: var(--color-primary);
		outline-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
	}
</style>
