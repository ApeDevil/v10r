<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		items: string[];
		direction?: 'left' | 'right';
		speed?: number;
		gap?: number;
		fontSize?: string;
		fontWeight?: number | string;
		opacity?: number;
		color?: string;
		separator?: string;
		pauseOnHover?: boolean;
		class?: string;
	}

	let {
		items,
		direction = 'left',
		speed = 30,
		gap = 32,
		fontSize = '1rem',
		fontWeight = 400,
		opacity = 0.06,
		color = 'currentColor',
		separator = '\u00B7',
		pauseOnHover = true,
		class: className
	}: Props = $props();

	let displayItems = $derived(
		items.flatMap((item, i) =>
			i < items.length - 1 ? [item, separator] : [item]
		)
	);
</script>

<div
	class={cn('marquee-outer', className)}
	style:opacity={opacity}
	style:color
	style:font-size={fontSize}
	style:font-weight={fontWeight}
	aria-hidden="true"
>
	<div
		class="marquee-track"
		class:pause-on-hover={pauseOnHover}
		style:--marquee-duration="{speed}s"
		style:--marquee-direction={direction === 'right' ? 'reverse' : 'normal'}
		style:gap="{gap}px"
	>
		{#each { length: 2 } as _}
			<span class="marquee-set" style:gap="{gap}px">
				{#each displayItems as item}
					<span class="marquee-item">{item}</span>
				{/each}
			</span>
		{/each}
	</div>
</div>

<style>
	.marquee-outer {
		overflow: hidden;
		white-space: nowrap;
	}

	.marquee-track {
		display: inline-flex;
		animation: marquee-scroll var(--marquee-duration) linear infinite;
		animation-direction: var(--marquee-direction);
	}

	.marquee-track.pause-on-hover:hover {
		animation-play-state: paused;
	}

	.marquee-set {
		display: inline-flex;
		flex-shrink: 0;
	}

	.marquee-item {
		display: inline-block;
	}

	@keyframes marquee-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-50%);
		}
	}

	@media (forced-colors: active) {
		.marquee-outer {
			display: none;
		}
	}
</style>
