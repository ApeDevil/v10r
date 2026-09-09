<script lang="ts" generics="T">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import { computeWindow, DEFAULT_OVERSCAN, offsetForIndex } from './virtual-list';

interface Props {
	/** The full dataset. Only the visible window is ever rendered. */
	items: T[];
	/** Uniform row height in pixels — must match what `row` actually renders. */
	itemHeight: number;
	/** Height of the scroll container. Any CSS length. */
	height?: string;
	/** Rows rendered beyond each edge, to cover a fast flick. */
	overscan?: number;
	/** Accessible name for the list. */
	label?: string;
	class?: string;
	row: Snippet<[T, number]>;
}

let {
	items,
	itemHeight,
	height = '24rem',
	overscan = DEFAULT_OVERSCAN,
	label,
	class: className,
	row,
}: Props = $props();

let viewport = $state<HTMLDivElement | null>(null);
let scrollTop = $state(0);
let viewportHeight = $state(0);
let activeIndex = $state(0);

const window_ = $derived(computeWindow({ scrollTop, viewportHeight, itemHeight, count: items.length, overscan }));
const visible = $derived(items.slice(window_.start, window_.end));

function onscroll(event: Event): void {
	scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
}

/**
 * Keyboard navigation has to be explicit here: the rows a user would Tab through
 * mostly do not exist, so the LIST owns focus and moves a roving active index. Paging
 * off the rendered window scrolls first, which is what puts the target row in the DOM.
 */
function onkeydown(event: KeyboardEvent): void {
	const page = Math.max(1, Math.floor(viewportHeight / itemHeight) - 1);
	const moves: Record<string, number> = {
		ArrowDown: 1,
		ArrowUp: -1,
		PageDown: page,
		PageUp: -page,
	};

	let next = activeIndex;
	if (event.key in moves) next = activeIndex + moves[event.key];
	else if (event.key === 'Home') next = 0;
	else if (event.key === 'End') next = items.length - 1;
	else return;

	event.preventDefault();
	activeIndex = Math.min(Math.max(0, next), Math.max(0, items.length - 1));
	scrollIntoWindow(activeIndex);
}

function scrollIntoWindow(index: number): void {
	if (!viewport) return;
	const top = offsetForIndex(index, itemHeight, items.length);
	const bottom = top + itemHeight;
	if (top < scrollTop) viewport.scrollTop = top;
	else if (bottom > scrollTop + viewportHeight) viewport.scrollTop = bottom - viewportHeight;
}
</script>

<div
	bind:this={viewport}
	bind:clientHeight={viewportHeight}
	class={cn('v10r-virtual-list', className)}
	style:height
	role="listbox"
	tabindex="0"
	aria-label={label}
	aria-activedescendant={items.length > 0 ? `virtual-row-${activeIndex}` : undefined}
	{onscroll}
	{onkeydown}
>
	<!-- The spacer gives the scrollbar the FULL data height; without it the bar would
	     describe the window instead of the list, and the position would jump on every
	     render. -->
	<div class="v10r-virtual-spacer" style:height="{window_.totalHeight}px">
		<div class="v10r-virtual-window" style:transform="translateY({window_.offsetTop}px)">
			{#each visible as item, offset (window_.start + offset)}
				{@const index = window_.start + offset}
				<div
					id="virtual-row-{index}"
					class="v10r-virtual-row"
					class:is-active={index === activeIndex}
					style:height="{itemHeight}px"
					role="option"
					aria-selected={index === activeIndex}
					aria-setsize={items.length}
					aria-posinset={index + 1}
				>
					{@render row(item, index)}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
.v10r-virtual-list {
	position: relative;
	overflow-y: auto;
	overflow-x: hidden;
	border-radius: var(--radius-md);
	outline: none;
}

.v10r-virtual-list:focus-visible {
	outline: 2px solid var(--color-ring);
	outline-offset: 2px;
}

.v10r-virtual-spacer {
	position: relative;
	width: 100%;
}

.v10r-virtual-window {
	position: absolute;
	inset-inline: 0;
	top: 0;
	will-change: transform;
}

.v10r-virtual-row {
	display: flex;
	align-items: center;
	box-sizing: border-box;
}

.v10r-virtual-row.is-active {
	/* The container pair, not bare `--color-accent`: `accent` is a strong fill meant to
	   carry `on-accent` text, and a row renders whatever the caller's snippet gives it.
	   `accent-container` is the token designed to sit behind arbitrary content. */
	background-color: var(--color-accent-container);
	color: var(--color-on-accent-container);
}
</style>
