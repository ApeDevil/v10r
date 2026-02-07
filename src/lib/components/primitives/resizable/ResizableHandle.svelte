<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { resizableHandleVariants, type ResizableHandleVariants, type ResizableContext } from './resizable';
	import { getContext, onDestroy } from 'svelte';

	interface Props extends ResizableHandleVariants {
		class?: string;
	}

	let { withHandle = false, class: className }: Props = $props();

	const ctx = getContext<ResizableContext>('resizable');
	const handleIndex = ctx.registerHandle();

	let direction = $derived(ctx.direction);
	let isDragging = $state(false);
	let startPos = $state(0);

	// ARIA values for screen reader announcements
	const leftSize = $derived(Math.round(ctx.sizes[handleIndex] ?? 0));
	const rightSize = $derived(Math.round(ctx.sizes[handleIndex + 1] ?? 0));
	const leftConstraints = $derived(ctx.getConstraints(handleIndex));
	const leftLabel = $derived(direction === 'horizontal' ? 'Left' : 'Top');
	const rightLabel = $derived(direction === 'horizontal' ? 'Right' : 'Bottom');

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		startPos = direction === 'horizontal' ? event.clientX : event.clientY;
		event.preventDefault();

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const currentPos = direction === 'horizontal' ? event.clientX : event.clientY;
		const deltaPx = currentPos - startPos;
		startPos = currentPos;
		ctx.resize(handleIndex, deltaPx);
	}

	function handleMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}

	function handleKeyDown(event: KeyboardEvent) {
		const groupEl = ctx.getGroupEl();
		if (!groupEl) return;
		const totalSize = direction === 'horizontal' ? groupEl.offsetWidth : groupEl.offsetHeight;
		const stepPx = totalSize * 0.02;

		if (direction === 'horizontal') {
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				ctx.resize(handleIndex, -stepPx);
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				ctx.resize(handleIndex, stepPx);
			}
		} else {
			if (event.key === 'ArrowUp') {
				event.preventDefault();
				ctx.resize(handleIndex, -stepPx);
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				ctx.resize(handleIndex, stepPx);
			}
		}
	}

	onDestroy(() => {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});
</script>

<div
	role="separator"
	tabindex="0"
	aria-orientation={direction}
	aria-valuenow={leftSize}
	aria-valuemin={Math.round(leftConstraints.min)}
	aria-valuemax={Math.round(leftConstraints.max)}
	aria-valuetext="{leftLabel} pane: {leftSize}%, {rightLabel} pane: {rightSize}%"
	data-direction={direction}
	class={cn(resizableHandleVariants({ direction, withHandle }), className)}
	onmousedown={handleMouseDown}
	onkeydown={handleKeyDown}
>
	{#if withHandle}
		<div
			class={cn(
				'absolute inset-0 flex items-center justify-center',
				direction === 'horizontal' ? 'flex-col gap-1' : 'flex-row gap-1'
			)}
		>
			<span class={cn('block bg-fg/40 rounded-full', direction === 'horizontal' ? 'w-1 h-1' : 'h-1 w-1')} />
			<span class={cn('block bg-fg/40 rounded-full', direction === 'horizontal' ? 'w-1 h-1' : 'h-1 w-1')} />
			<span class={cn('block bg-fg/40 rounded-full', direction === 'horizontal' ? 'w-1 h-1' : 'h-1 w-1')} />
		</div>
	{/if}
</div>
