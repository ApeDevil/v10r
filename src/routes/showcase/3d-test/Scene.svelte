<script lang="ts">
	import { T, useTask } from '@threlte/core';

	let rotation = $state(0);

	useTask((delta) => {
		rotation += delta;
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 0, 5]} />
<T.DirectionalLight position={[5, 10, 5]} />
<T.AmbientLight intensity={0.5} />

<T.Mesh rotation.y={rotation}>
	<T.BoxGeometry />
	<T.MeshStandardMaterial color="hotpink" />
</T.Mesh>
