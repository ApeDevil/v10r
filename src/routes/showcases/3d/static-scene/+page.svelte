<script lang="ts">
	import { PageHeader } from '$lib/components';
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls, GLTF } from '@threlte/extras';
</script>

<svelte:head>
	<title>Static Scene - 3D - Velociraptor</title>
</svelte:head>

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

<style>
	.container {
		width: 100%;
		height: 100vh;
	}
</style>
