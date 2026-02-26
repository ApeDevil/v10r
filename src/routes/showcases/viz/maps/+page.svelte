<script lang="ts">
	import { onMount } from 'svelte';
	import { PageHeader, BackLink, NavSection, BoundaryFallback } from '$lib/components/composites';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives/table';
	import VizDemoCard from '../_components/VizDemoCard.svelte';
	import { GeoMap, MapMarker, MapPopup } from '$lib/components/viz';
	import { getVizPalette } from '$lib/components/viz/_shared/theme-bridge';
	import type { Component } from 'svelte';

	const sections = [
		{ id: 'basic-map', label: 'Basic Map' },
		{ id: 'markers-popups', label: 'Markers' },
		{ id: 'choropleth', label: 'Choropleth' },
	];

	// --- Section 2: Markers data ---
	const markers = [
		{ city: 'San Francisco', lnglat: { lng: -122.42, lat: 37.78 }, description: 'Silicon Valley hub' },
		{ city: 'London', lnglat: { lng: -0.12, lat: 51.51 }, description: 'European fintech center' },
		{ city: 'Tokyo', lnglat: { lng: 139.69, lat: 35.69 }, description: 'Electronics and robotics' },
		{ city: 'Bangalore', lnglat: { lng: 77.59, lat: 12.97 }, description: 'India\'s tech capital' },
		{ city: 'Berlin', lnglat: { lng: 13.40, lat: 52.52 }, description: 'European startup scene' },
		{ city: 'Singapore', lnglat: { lng: 103.85, lat: 1.29 }, description: 'Asia-Pacific gateway' },
	];

	// --- Section 3: Choropleth (dynamic imports) ---
	const STATES_GEOJSON = 'https://maplibre.org/maplibre-gl-js/docs/assets/us_states.geojson';

	let GeoJSONSource: Component<any> | undefined = $state();
	let FillLayer: Component<any> | undefined = $state();
	let LineLayer: Component<any> | undefined = $state();
	let FeatureStateComp: Component<any> | undefined = $state();
	let PopupComp: Component<any> | undefined = $state();
	let choroplethReady = $state(false);
	let palette = $state<string[]>([]);

	let hoveredFeature: any = $state(undefined);
	let hoverLngLat: { lng: number; lat: number } | undefined = $state(undefined);

	onMount(async () => {
		const sml = await import('svelte-maplibre-gl');
		GeoJSONSource = sml.GeoJSONSource;
		FillLayer = sml.FillLayer;
		LineLayer = sml.LineLayer;
		FeatureStateComp = sml.FeatureState;
		PopupComp = sml.Popup;
		palette = getVizPalette();
		choroplethReady = true;
	});

	const choroplethRegions = [
		{ region: 'Northeast', states: 'CT, MA, ME, NH, NJ, NY, PA, RI, VT' },
		{ region: 'Southeast', states: 'AL, FL, GA, KY, MD, NC, SC, TN, VA, WV' },
		{ region: 'Midwest', states: 'IA, IL, IN, KS, MI, MN, MO, NE, ND, OH, SD, WI' },
		{ region: 'Southwest', states: 'AZ, NM, OK, TX' },
		{ region: 'West', states: 'CA, CO, ID, MT, NV, OR, UT, WA, WY' },
	];
</script>

<svelte:head>
	<title>Maps - Viz Showcase - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Maps"
		description="Interactive maps with markers, popups, and data layers powered by MapLibre GL. Auto-switching light/dark tile themes."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Viz', href: '/showcases/viz' },
			{ label: 'Maps' }
		]}
	/>

	<NavSection {sections} />

	<svelte:boundary>
	<main class="content">
		<!-- Basic Map -->
		<section id="basic-map" class="section">
			<h2 class="section-title">Basic Map</h2>
			<p class="section-description">A simple interactive map centered on Europe. Includes zoom/pan controls and scale bar. Tile theme auto-switches with dark mode.</p>

			<div class="demos">
				<VizDemoCard
					title="Europe View"
					description="CartoDB Voyager tiles (light) / Dark Matter (dark). Drag to pan, scroll to zoom."
				>
					{#snippet visualization()}
						<GeoMap
							center={{ lng: 10, lat: 48 }}
							zoom={4}
							ariaLabel="Map of Europe"
						/>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Property</HeaderCell>
									<HeaderCell>Value</HeaderCell>
								</Row>
							</Header>
							<Body>
								<Row>
									<Cell>Center</Cell>
									<Cell>10.0\u00b0E, 48.0\u00b0N</Cell>
								</Row>
								<Row>
									<Cell>Zoom</Cell>
									<Cell>4</Cell>
								</Row>
								<Row>
									<Cell>Provider</Cell>
									<Cell>CartoDB (Voyager / Dark Matter)</Cell>
								</Row>
								<Row>
									<Cell>Controls</Cell>
									<Cell>Navigation, Scale</Cell>
								</Row>
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<GeoMap
  center={{ lng: 10, lat: 48 }}
  zoom={4}
  ariaLabel="Map of Europe"
/>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- Markers & Popups -->
		<section id="markers-popups" class="section">
			<h2 class="section-title">Markers &amp; Popups</h2>
			<p class="section-description">Map markers at global tech hubs. Click a marker to open its popup with location details.</p>

			<div class="demos">
				<VizDemoCard
					title="Tech Hubs"
					description="Six markers placed at major technology centers. Each marker has a popup with city info."
				>
					{#snippet visualization()}
						<GeoMap
							center={{ lng: 20, lat: 25 }}
							zoom={2}
							ariaLabel="World map with tech hub markers"
						>
							{#each markers as marker}
								<MapMarker lnglat={marker.lnglat}>
									<MapPopup offset={25}>
										<strong>{marker.city}</strong>
										<br />
										<span class="popup-detail">{marker.description}</span>
									</MapPopup>
								</MapMarker>
							{/each}
						</GeoMap>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>City</HeaderCell>
									<HeaderCell>Coordinates</HeaderCell>
									<HeaderCell>Description</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each markers as marker}
									<Row>
										<Cell>{marker.city}</Cell>
										<Cell>{marker.lnglat.lng.toFixed(2)}, {marker.lnglat.lat.toFixed(2)}</Cell>
										<Cell>{marker.description}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<GeoMap center={{ lng: 20, lat: 25 }} zoom={2}>
  {#each markers as marker}
    <MapMarker lnglat={marker.lnglat}>
      <MapPopup offset={25}>
        <strong>{marker.city}</strong>
        <p>{marker.description}</p>
      </MapPopup>
    </MapMarker>
  {/each}
</GeoMap>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>

		<!-- GeoJSON Choropleth -->
		<section id="choropleth" class="section">
			<h2 class="section-title">GeoJSON Choropleth</h2>
			<p class="section-description">US states rendered from GeoJSON with data-driven fill colors. Uses GeoJSONSource, FillLayer, and LineLayer from svelte-maplibre-gl directly.</p>

			<div class="demos">
				<VizDemoCard
					title="US States"
					description="GeoJSON polygon fill with hover interaction. Hover a state to see its name."
				>
					{#snippet visualization()}
						<GeoMap
							center={{ lng: -98, lat: 38 }}
							zoom={3}
							ariaLabel="Choropleth map of US states"
						>
							{#if choroplethReady && GeoJSONSource && FillLayer && LineLayer}
								<GeoJSONSource data={STATES_GEOJSON}>
									<FillLayer
										paint={{
											'fill-color': palette[0] || '#3b82f6',
											'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.5, 0.2],
										}}
										onmousemove={(ev: any) => {
											hoveredFeature = ev.features?.[0];
											hoverLngLat = ev.lngLat;
										}}
										onmouseleave={() => {
											hoveredFeature = undefined;
											hoverLngLat = undefined;
										}}
									/>
									<LineLayer
										paint={{
											'line-color': palette[0] || '#3b82f6',
											'line-opacity': 0.6,
											'line-width': 1,
										}}
									/>
									{#if hoveredFeature && FeatureStateComp && PopupComp && hoverLngLat}
										<FeatureStateComp id={hoveredFeature.id} state={{ hover: true }} />
										<PopupComp lnglat={hoverLngLat} closeButton={false} offset={10}>
											<strong>{hoveredFeature.properties?.STATE_NAME ?? 'Unknown'}</strong>
										</PopupComp>
									{/if}
								</GeoJSONSource>
							{/if}
						</GeoMap>
					{/snippet}
					{#snippet dataTable()}
						<Table>
							<Header>
								<Row hoverable={false}>
									<HeaderCell>Region</HeaderCell>
									<HeaderCell>States</HeaderCell>
								</Row>
							</Header>
							<Body>
								{#each choroplethRegions as region}
									<Row>
										<Cell>{region.region}</Cell>
										<Cell>{region.states}</Cell>
									</Row>
								{/each}
							</Body>
						</Table>
					{/snippet}
					{#snippet code()}
						<pre><code>{`<!-- Import svelte-maplibre-gl components directly -->
<script>
  import { GeoJSONSource, FillLayer, LineLayer,
    FeatureState, Popup } from 'svelte-maplibre-gl';
</script>

<GeoMap center={{ lng: -98, lat: 38 }} zoom={3}>
  <GeoJSONSource data={geojsonUrl}>
    <FillLayer
      paint={{
        'fill-color': '#3b82f6',
        'fill-opacity': ['case',
          ['boolean', ['feature-state', 'hover'], false],
          0.5, 0.2],
      }}
      onmousemove={(ev) => {
        hoveredFeature = ev.features?.[0];
      }}
    />
    <LineLayer paint={{ 'line-color': '#3b82f6' }} />
    {#if hoveredFeature}
      <FeatureState id={hoveredFeature.id}
        state={{ hover: true }} />
    {/if}
  </GeoJSONSource>
</GeoMap>`}</code></pre>
					{/snippet}
				</VizDemoCard>
			</div>
		</section>
	</main>

	{#snippet failed(error, reset)}
		<BoundaryFallback
			title="Visualization failed to render"
			description="The data may be in an unexpected format."
			{reset}
		/>
	{/snippet}
	</svelte:boundary>

	<BackLink href="/showcases/viz" label="Viz" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.content {
	}

	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	:global(.popup-detail) {
		color: var(--color-muted);
		font-size: 12px;
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
