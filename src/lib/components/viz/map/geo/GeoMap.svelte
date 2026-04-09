<script lang="ts">
import type { Component, Snippet } from 'svelte';
import { onMount } from 'svelte';
import { beforeNavigate } from '$app/navigation';
import { getTheme } from '$lib/state/theme.svelte';
import { cn } from '$lib/utils/cn';
import { type ChartContainerVariants, chartContainerVariants } from '../../_shared/chart-container';
import { CARTO_DARK_MATTER, CARTO_VOYAGER, fetchRewrittenStyle } from './map-theme';

interface Props {
	center?: { lng: number; lat: number };
	zoom?: number;
	style?: string;
	lightStyle?: string;
	darkStyle?: string;
	aspect?: ChartContainerVariants['aspect'];
	ariaLabel?: string;
	maxBounds?: [[number, number], [number, number]];
	minZoom?: number;
	maxZoom?: number;
	class?: string;
	children?: Snippet;
}

let {
	center = { lng: 0, lat: 20 },
	zoom = 2,
	style: styleProp,
	lightStyle = CARTO_VOYAGER,
	darkStyle = CARTO_DARK_MATTER,
	aspect = 'auto',
	ariaLabel = 'Interactive map',
	maxBounds,
	minZoom,
	maxZoom,
	class: className,
	children,
}: Props = $props();

let ready = $state(false);
let MapLibreComp: Component<Record<string, unknown>> | undefined = $state();
let NavigationControl: Component<Record<string, unknown>> | undefined = $state();
let ScaleControl: Component<Record<string, unknown>> | undefined = $state();
let resolvedStyle: object | string | undefined = $state();

const theme = getTheme();
const currentStyleUrl = $derived(styleProp ?? (theme.isDark ? darkStyle : lightStyle));

beforeNavigate(() => {
	ready = false;
});

// Re-resolve style when theme changes (fall back to raw URL if rewrite fails)
$effect(() => {
	const url = currentStyleUrl;
	fetchRewrittenStyle(url)
		.then((s) => {
			resolvedStyle = s;
		})
		.catch(() => {
			resolvedStyle = url;
		});
});

onMount(async () => {
	const [sml] = await Promise.all([import('svelte-maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);

	MapLibreComp = sml.MapLibre;
	NavigationControl = sml.NavigationControl;
	ScaleControl = sml.ScaleControl;
	ready = true;
});
</script>

<figure class={cn(chartContainerVariants({ aspect }), 'map-container', className)}>
	<figcaption class="sr-only">{ariaLabel}</figcaption>

	{#if !ready || !MapLibreComp || !NavigationControl || !ScaleControl || !resolvedStyle}
		<div class="skeleton" role="status">
			<svg viewBox="0 0 400 300" class="skeleton-svg" aria-hidden="true">
				<path d="M60,100 Q80,60 120,70 T160,90 Q180,100 170,130 T130,150 Q100,140 60,100Z" class="skeleton-land pulse-1" />
				<path d="M200,50 Q240,30 280,60 T300,100 Q290,130 250,120 T200,90Z" class="skeleton-land pulse-2" />
				<path d="M230,140 Q260,120 300,150 T290,190 Q270,210 240,200 T220,170Z" class="skeleton-land pulse-3" />
				<path d="M80,170 Q100,150 130,170 T120,210 Q100,230 80,220Z" class="skeleton-land pulse-4" />
				<path d="M310,50 Q330,40 350,55 T345,80 Q335,90 315,85Z" class="skeleton-land pulse-1" />
				<path d="M140,220 Q165,210 180,230 T165,260 Q145,265 135,250Z" class="skeleton-land pulse-3" />
			</svg>
			<span class="sr-only">Loading map</span>
		</div>
	{:else}
		<div class="map-wrapper visible">
			<MapLibreComp
				style={resolvedStyle}
				{center}
				{zoom}
				{maxBounds}
				{minZoom}
				{maxZoom}
			>
				<NavigationControl position="top-right" />
				<ScaleControl position="bottom-left" />
				{#if children}
					{@render children()}
				{/if}
			</MapLibreComp>
		</div>
	{/if}
</figure>

<style>
	.map-container {
		overflow: hidden;
		position: relative;
		height: 400px;
	}

	.skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.skeleton-svg {
		width: 100%;
		height: 100%;
		max-height: 300px;
	}

	.skeleton-land {
		fill: var(--chart-grid);
	}

	.pulse-1 { animation: pulse 1.5s ease-in-out infinite; }
	.pulse-2 { animation: pulse 1.5s ease-in-out 0.15s infinite; }
	.pulse-3 { animation: pulse 1.5s ease-in-out 0.3s infinite; }
	.pulse-4 { animation: pulse 1.5s ease-in-out 0.45s infinite; }

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.map-wrapper {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.15s ease-in;
	}

	.map-wrapper.visible {
		opacity: 1;
	}

	.map-wrapper :global(.maplibregl-map) {
		width: 100%;
		height: 100%;
	}

	/* MapLibre GL control overrides using design tokens */
	.map-wrapper :global(.maplibregl-ctrl-group) {
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: none;
		overflow: hidden;
	}

	.map-wrapper :global(.maplibregl-ctrl-group button) {
		width: 30px;
		height: 30px;
		border-bottom: 1px solid var(--color-border);
	}

	.map-wrapper :global(.maplibregl-ctrl-group button:hover) {
		background: var(--color-subtle);
	}

	.map-wrapper :global(.maplibregl-ctrl-group button + button) {
		border-top: none;
	}

	.map-wrapper :global(.maplibregl-ctrl-scale) {
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		border-top: none;
		color: var(--color-muted);
		font-size: 10px;
		padding: 0 4px;
		line-height: 18px;
	}

	/* Popup theming */
	.map-wrapper :global(.maplibregl-popup-content) {
		background: var(--surface-1);
		color: var(--color-fg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
		padding: 8px 12px;
		font-size: 13px;
	}

	.map-wrapper :global(.maplibregl-popup-close-button) {
		color: var(--color-muted);
		font-size: 16px;
		padding: 2px 6px;
	}

	.map-wrapper :global(.maplibregl-popup-close-button:hover) {
		color: var(--color-fg);
		background: transparent;
	}

	.map-wrapper :global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
		border-bottom-color: var(--color-border);
	}

	.map-wrapper :global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
		border-top-color: var(--color-border);
	}

	.map-wrapper :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
		border-right-color: var(--color-border);
	}

	.map-wrapper :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
		border-left-color: var(--color-border);
	}

	/* Dark mode: invert control icons */
	:global(.dark) .map-wrapper :global(.maplibregl-ctrl-group button .maplibregl-ctrl-icon) {
		filter: invert(1);
	}
</style>
