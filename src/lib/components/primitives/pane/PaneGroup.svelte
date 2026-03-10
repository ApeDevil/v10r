<script lang="ts">
import { PaneGroup } from 'paneforge';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

export interface PaneGroupHandle {
	getLayout: () => number[];
	setLayout: (layout: number[]) => void;
	getId: () => string;
}

interface Props {
	direction?: 'horizontal' | 'vertical';
	autoSaveId?: string;
	onLayoutChange?: (layout: number[]) => void;
	children?: Snippet;
	class?: string;
}

let { direction = 'horizontal', autoSaveId, onLayoutChange, children, class: className }: Props = $props();

let paneGroupRef = $state<PaneGroupHandle | undefined>();

export function getLayout(): number[] {
	return paneGroupRef?.getLayout() ?? [];
}

export function setLayout(layout: number[]): void {
	paneGroupRef?.setLayout(layout);
}

export function getId(): string {
	return paneGroupRef?.getId() ?? '';
}
</script>

<PaneGroup
	bind:this={paneGroupRef}
	{direction}
	{autoSaveId}
	{onLayoutChange}
	class={cn('flex overflow-hidden', direction === 'vertical' && 'flex-col', className)}
>
	{#if children}
		{@render children()}
	{/if}
</PaneGroup>
