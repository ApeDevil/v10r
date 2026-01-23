<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import { OrbitControls, GLTF } from '@threlte/extras';
</script>

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
