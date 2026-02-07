<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';

	interface Props {
		value?: number[];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		orientation?: 'horizontal' | 'vertical';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}

	let {
		value = $bindable([0]),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		orientation = 'horizontal',
		size = 'md',
		class: className
	}: Props = $props();

	const isRange = $derived(value.length === 2);
</script>

<SliderPrimitive.Root
	bind:value
	type={isRange ? 'multiple' : 'single'}
	{min}
	{max}
	{step}
	{disabled}
	{orientation}
	class={cn(`slider-${size}`, className)}
>
	<span class="slider-track">
		<SliderPrimitive.Range />
	</span>

	{#if isRange}
		<SliderPrimitive.Thumb index={0} />
		<SliderPrimitive.Thumb index={1} />
	{:else}
		<SliderPrimitive.Thumb index={0} />
	{/if}
</SliderPrimitive.Root>

<style>
	/* Root */
	:global([data-slider-root]) {
		display: flex;
		align-items: center;
		position: relative;
		user-select: none;
		touch-action: none;
	}

	:global([data-slider-root][data-orientation='horizontal']) {
		width: 100%;
		flex-direction: row;
	}

	:global([data-slider-root][data-orientation='vertical']) {
		height: 100%;
		flex-direction: column;
	}

	/* Track (plain HTML element) */
	:global([data-slider-root]) .slider-track {
		position: relative;
		flex-grow: 1;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		height: 0.375rem;
	}

	:global(.slider-sm) .slider-track {
		height: 0.25rem;
	}

	:global(.slider-lg) .slider-track {
		height: 0.5rem;
	}

	/* Range (filled portion) */
	:global([data-slider-range]) {
		position: absolute;
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--color-primary);
	}

	/* Thumb */
	:global([data-slider-thumb]) {
		display: block;
		border-radius: var(--radius-full);
		border: 2px solid var(--color-primary);
		background: white;
		box-shadow: var(--shadow-md);
		cursor: pointer;
		width: 1.25rem;
		height: 1.25rem;
		transition: background-color var(--duration-fast) ease;
	}

	:global(.slider-sm [data-slider-thumb]) {
		width: 1rem;
		height: 1rem;
	}

	:global(.slider-lg [data-slider-thumb]) {
		width: 1.5rem;
		height: 1.5rem;
	}

	:global([data-slider-thumb]:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	:global([data-slider-thumb]:hover) {
		background: color-mix(in srgb, var(--color-primary) 5%, white);
	}

	:global([data-slider-thumb][data-disabled]) {
		pointer-events: none;
		opacity: 0.5;
	}

	/* Dark mode thumb */
	:global(.dark [data-slider-thumb]) {
		background: var(--surface-1);
	}

	:global(.dark [data-slider-thumb]:hover) {
		background: color-mix(in srgb, var(--color-primary) 15%, var(--surface-1));
	}
</style>
