<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		sliderRootVariants,
		sliderTrackVariants,
		sliderRangeVariants,
		sliderThumbVariants,
		type SliderRootVariants,
		type SliderTrackVariants,
		type SliderThumbVariants
	} from './slider';

	interface Props extends SliderRootVariants, SliderTrackVariants, SliderThumbVariants {
		value?: number[];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
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

	// Determine if range mode (2 thumbs) or single mode (1 thumb)
	const isRange = $derived(value.length === 2);
</script>

<SliderPrimitive.Root
	bind:value
	{min}
	{max}
	{step}
	{disabled}
	{orientation}
	class={cn(sliderRootVariants({ orientation }), className)}
>
	<SliderPrimitive.Track class={cn(sliderTrackVariants({ size, orientation }))}>
		<SliderPrimitive.Range class={cn(sliderRangeVariants())} />
	</SliderPrimitive.Track>

	{#if isRange}
		<!-- Range mode: 2 thumbs -->
		<SliderPrimitive.Thumb class={cn(sliderThumbVariants({ size }))} />
		<SliderPrimitive.Thumb class={cn(sliderThumbVariants({ size }))} />
	{:else}
		<!-- Single value mode: 1 thumb -->
		<SliderPrimitive.Thumb class={cn(sliderThumbVariants({ size }))} />
	{/if}
</SliderPrimitive.Root>
