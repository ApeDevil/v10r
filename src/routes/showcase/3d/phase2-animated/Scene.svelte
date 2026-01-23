<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { OrbitControls, useGltf } from '@threlte/extras';
	import { AnimationMixer, type AnimationClip, type Group } from 'three';

	let { currentAnimation }: { currentAnimation: string } = $props();

	const gltf = useGltf('/models/Fox.glb');

	let mixer: AnimationMixer | null = null;
	let clips: AnimationClip[] = [];
	let scene: Group | null = null;

	// Load model and create mixer once
	gltf.then((data) => {
		scene = data.scene;
		clips = data.animations;
		mixer = new AnimationMixer(data.scene);
		playAnimation(currentAnimation);
	});

	function playAnimation(name: string) {
		if (!mixer || clips.length === 0) return;
		mixer.stopAllAction();
		const clip = clips.find((c) => c.name === name);
		if (clip) {
			mixer.clipAction(clip).play();
		}
	}

	// React to animation changes
	$effect(() => {
		playAnimation(currentAnimation);
	});

	useTask((delta) => {
		mixer?.update(delta);
	});
</script>

<T.PerspectiveCamera makeDefault position={[100, 50, 100]}>
	<OrbitControls target={[0, 30, 0]} />
</T.PerspectiveCamera>
<T.DirectionalLight position={[100, 100, 100]} intensity={1} />
<T.AmbientLight intensity={0.5} />

{#await gltf then data}
	<T is={data.scene} />
{/await}

<T.GridHelper args={[200, 20]} />
