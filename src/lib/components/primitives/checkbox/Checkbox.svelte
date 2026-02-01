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

<div class={cn('flex items-center gap-2', className)}>
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
				'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border cursor-pointer',
				'transition-colors duration-fast',
				'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
				'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
				'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-white'
			)}
		>
			{#if checked}
				<span class="i-lucide-check h-4 w-4" />
			{/if}
		</label>
	</div>
	{#if label}
		<label
			for={id}
			class={cn('text-fluid-sm text-fg cursor-pointer select-none', {
				'opacity-50 cursor-not-allowed': restProps.disabled
			})}
		>
			{label}
		</label>
	{/if}
</div>
