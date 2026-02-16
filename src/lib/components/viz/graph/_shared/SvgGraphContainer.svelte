<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import { chartContainerVariants, type ChartContainerVariants } from '../../_shared/chart-container';

	interface Props {
		aspect?: ChartContainerVariants['aspect'];
		ariaLabel?: string;
		children: Snippet<[{ width: number; height: number; transform: string }]>;
		skeleton?: Snippet;
		onResize?: (width: number, height: number) => void;
		class?: string;
	}

	let {
		aspect = 'chart',
		ariaLabel = 'Graph visualization',
		children,
		skeleton,
		onResize,
		class: className,
	}: Props = $props();

	let containerEl: HTMLDivElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();
	let width = $state(600);
	let height = $state(400);
	let ready = $state(false);
	let transform = $state('translate(0,0) scale(1)');
	let zoomLevel = $state(1);
	let showZoomIndicator = $state(false);
	let zoomIndicatorTimeout: ReturnType<typeof setTimeout> | undefined;

	let resizeObserver: ResizeObserver | undefined;
	// D3 zoom/selection types are complex generics — use any for internal state
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let zoomBehavior: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let d3Sel: any;
	// Cached from onMount to avoid re-importing
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let zoomIdentity: any;

	function cleanup() {
		resizeObserver?.disconnect();
		resizeObserver = undefined;
		clearTimeout(zoomIndicatorTimeout);
		zoomIndicatorTimeout = undefined;
		// Remove d3-zoom listeners
		if (d3Sel) {
			d3Sel.on('.zoom', null);
		}
		d3Sel = undefined;
		zoomBehavior = undefined;
	}

	beforeNavigate(cleanup);
	onDestroy(cleanup);

	onMount(async () => {
		const [d3Zoom, d3Selection_] = await Promise.all([
			import('d3-zoom'),
			import('d3-selection'),
		]);

		if (!svgEl || !containerEl) return;

		// Initial sizing
		const rect = containerEl.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
		onResize?.(width, height);

		// ResizeObserver for responsive sizing
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const cr = entry.contentRect;
				width = cr.width;
				height = cr.height;
				onResize?.(cr.width, cr.height);
			}
		});
		resizeObserver.observe(containerEl);

		// d3-zoom: Ctrl/Cmd+scroll for zoom, drag for pan
		zoomBehavior = d3Zoom.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 8])
			.filter((event: Event) => {
				// Allow drag (mousedown) for panning
				if (event.type === 'mousedown' || event.type === 'touchstart') return true;
				// For wheel events, require Ctrl/Cmd modifier (prevents page scroll hijack)
				if (event.type === 'wheel') {
					return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
				}
				// Allow dblclick for zoom reset
				if (event.type === 'dblclick') return true;
				return false;
			})
			.on('zoom', (event) => {
				const t = event.transform;
				transform = `translate(${t.x},${t.y}) scale(${t.k})`;
				zoomLevel = t.k;

				// Show zoom indicator briefly
				showZoomIndicator = true;
				clearTimeout(zoomIndicatorTimeout);
				zoomIndicatorTimeout = setTimeout(() => {
					showZoomIndicator = false;
				}, 2000);
			});

		d3Sel = d3Selection_.select(svgEl);
		d3Sel.call(zoomBehavior);

		zoomIdentity = d3Zoom.zoomIdentity;
		ready = true;
	});

	function handleZoomIn() {
		if (!zoomBehavior || !d3Sel) return;
		zoomBehavior.scaleBy(d3Sel, 1.3);
	}

	function handleZoomOut() {
		if (!zoomBehavior || !d3Sel) return;
		zoomBehavior.scaleBy(d3Sel, 0.7);
	}

	function handleFitToView() {
		if (!zoomBehavior || !d3Sel || !zoomIdentity) return;
		zoomBehavior.transform(d3Sel, zoomIdentity);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			handleZoomIn();
		} else if (event.key === '-') {
			event.preventDefault();
			handleZoomOut();
		} else if (event.key === '0' || event.key === 'f') {
			event.preventDefault();
			handleFitToView();
		} else if (event.key === 'Escape') {
			// Bubble escape to child components for deselection
		}
	}
</script>

<figure class={cn(chartContainerVariants({ aspect }), 'graph-container', className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready && skeleton}
		<div class="skeleton" role="status">
			{@render skeleton()}
			<span class="sr-only">Loading graph</span>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={containerEl}
		class="svg-wrapper"
		class:visible={ready}
		onkeydown={handleKeydown}
		tabindex="0"
		role="application"
		aria-label={ariaLabel}
	>
		<svg
			bind:this={svgEl}
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			class="graph-svg"
		>
			<g {transform}>
				{@render children({ width, height, transform })}
			</g>
		</svg>
	</div>

	<!-- Zoom controls -->
	{#if ready}
		<div class="zoom-controls" aria-label="Zoom controls">
			<button
				class="zoom-btn"
				onclick={handleZoomIn}
				aria-label="Zoom in"
				title="Zoom in (+)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
			<button
				class="zoom-btn"
				onclick={handleZoomOut}
				aria-label="Zoom out"
				title="Zoom out (-)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
			<button
				class="zoom-btn"
				onclick={handleFitToView}
				aria-label="Fit to view"
				title="Fit to view (0)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
				</svg>
			</button>
		</div>

		{#if showZoomIndicator && Math.abs(zoomLevel - 1) > 0.01}
			<div class="zoom-indicator" aria-live="polite">
				{Math.round(zoomLevel * 100)}%
			</div>
		{/if}
	{/if}
</figure>

<style>
	.graph-container {
		overflow: hidden;
		position: relative;
	}

	.skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.svg-wrapper {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.15s ease-in;
		cursor: grab;
		outline: none;
	}

	.svg-wrapper:active {
		cursor: grabbing;
	}

	.svg-wrapper:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		border-radius: var(--radius-md);
	}

	.svg-wrapper.visible {
		opacity: 1;
	}

	.graph-svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.zoom-controls {
		position: absolute;
		bottom: var(--spacing-4);
		right: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		background: color-mix(in srgb, var(--surface-1) 85%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-1);
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		transition: color var(--duration-fast), background var(--duration-fast);
	}

	.zoom-btn:hover {
		color: var(--color-fg);
		background: var(--color-subtle);
	}

	.zoom-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.zoom-indicator {
		position: absolute;
		bottom: var(--spacing-4);
		left: 50%;
		transform: translateX(-50%);
		background: color-mix(in srgb, var(--surface-1) 85%, transparent);
		backdrop-filter: blur(8px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-1) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		pointer-events: none;
	}
</style>
