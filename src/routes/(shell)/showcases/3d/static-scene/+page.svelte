<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components';
	import { BoundaryFallback } from '$lib/components/composites';
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls, GLTF } from '@threlte/extras';
</script>

<svelte:head>
	<title>Static Scene - 3D - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Static Scene"
		description="GLTF model with orbit controls and directional lighting."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: '3D', href: '/showcases/3d' },
			{ label: 'Static Scene' }
		]}
	/>
</div>

<svelte:boundary>
	<div class="container">
		<Canvas>
			<T.PerspectiveCamera makeDefault position={[3, 3, 3]}>
				<OrbitControls />
			</T.PerspectiveCamera>
			<T.DirectionalLight position={[10, 10, 10]} intensity={1} />
			<T.AmbientLight intensity={0.5} />

			<GLTF url="/models/DamagedHelmet.glb" />
		</Canvas>
	</div>

	{#snippet failed(error, reset)}
		<BoundaryFallback
			title="3D scene unavailable"
			description="WebGL is required. Check browser support or graphics drivers."
			minHeight="100vh"
			{reset}
		/>
	{/snippet}
</svelte:boundary>

<div class="page">
	<BackLink href="/showcases/3d" label="3D" />
</div>

<style>
	.page {
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	.container {
		width: 100%;
		height: 100vh;
	}
</style>
