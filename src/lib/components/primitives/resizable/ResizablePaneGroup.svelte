<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import {
		resizablePaneGroupVariants,
		type ResizablePaneGroupVariants,
		type ResizableContext
	} from './resizable';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props extends ResizablePaneGroupVariants {
		children?: Snippet;
		class?: string;
	}

	let { direction = 'horizontal', children, class: className }: Props = $props();

	let groupEl: HTMLElement | undefined = $state();
	let paneSizes: number[] = $state([]);
	let paneConstraints: { min: number; max: number }[] = [];
	let handleCount = 0;

	const ctx: ResizableContext = {
		get direction() {
			return direction;
		},
		get sizes() {
			return paneSizes;
		},
		getGroupEl() {
			return groupEl;
		},
		getConstraints(paneIndex: number) {
			return paneConstraints[paneIndex] ?? { min: 0, max: 100 };
		},
		registerPane(defaultSize, min, max) {
			const index = paneSizes.length;
			paneSizes.push(defaultSize);
			paneConstraints.push({ min, max });
			return index;
		},
		registerHandle() {
			return handleCount++;
		},
		resize(handleIndex, deltaPx) {
			if (!groupEl) return;
			const totalSize =
				direction === 'horizontal' ? groupEl.offsetWidth : groupEl.offsetHeight;
			if (totalSize === 0) return;

			const deltaPercent = (deltaPx / totalSize) * 100;
			const i = handleIndex;
			const j = handleIndex + 1;
			if (i >= paneSizes.length || j >= paneSizes.length) return;

			let newI = paneSizes[i] + deltaPercent;
			let newJ = paneSizes[j] - deltaPercent;

			const { min: minI, max: maxI } = paneConstraints[i];
			const { min: minJ, max: maxJ } = paneConstraints[j];

			// Clamp with compensation to preserve total
			if (newI < minI) {
				newJ -= minI - newI;
				newI = minI;
			} else if (newI > maxI) {
				newJ += newI - maxI;
				newI = maxI;
			}
			if (newJ < minJ) {
				newI -= minJ - newJ;
				newJ = minJ;
			} else if (newJ > maxJ) {
				newI += newJ - maxJ;
				newJ = maxJ;
			}

			paneSizes[i] = Math.max(0, newI);
			paneSizes[j] = Math.max(0, newJ);
		}
	};

	setContext('resizable', ctx);
</script>

<div
	bind:this={groupEl}
	role="group"
	class={cn(resizablePaneGroupVariants({ direction }), className)}
>
	{#if children}
		{@render children()}
	{/if}
</div>
