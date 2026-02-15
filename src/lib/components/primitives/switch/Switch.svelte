<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import { switchRootVariants, switchThumbVariants, type SwitchVariants } from './switch';

	interface Props extends SwitchVariants {
		id?: string;
		checked?: boolean;
		disabled?: boolean;
		label?: string;
		class?: string;
	}

	let {
		id: propId,
		checked = $bindable(false),
		disabled = false,
		size = 'md',
		label,
		class: className
	}: Props = $props();

	const id = propId ?? `switch-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if label}
	<div class={cn('switch-wrap flex items-center gap-2', className)}>
		<SwitchPrimitive.Root
			bind:checked
			{disabled}
			{id}
			class={cn(switchRootVariants({ size }))}
		>
			<SwitchPrimitive.Thumb class={cn(switchThumbVariants({ size }))} />
		</SwitchPrimitive.Root>
		<label
			for={id}
			class={cn('text-fluid-sm text-fg cursor-pointer select-none', {
				'opacity-50 cursor-not-allowed': disabled
			})}
		>
			{label}
		</label>
	</div>
{:else}
	<span class="switch-wrap">
		<SwitchPrimitive.Root
			bind:checked
			{disabled}
			class={cn(switchRootVariants({ size }), className)}
		>
			<SwitchPrimitive.Thumb class={cn(switchThumbVariants({ size }))} />
		</SwitchPrimitive.Root>
	</span>
{/if}

<style>
	/* Off state: transparent pill with fg inset ring */
	.switch-wrap :global([data-state="unchecked"]) {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-fg);
	}

	/* Off state thumb: transparent with fg inset ring, no outer shadow */
	.switch-wrap :global([data-state="unchecked"] [data-state="unchecked"]) {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-fg);
	}
</style>
