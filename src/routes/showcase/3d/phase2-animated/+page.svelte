<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';

	let currentAnimation = $state('Survey');
	const animationNames = ['Survey', 'Walk', 'Run'];
</script>

<div class="controls">
	{#each animationNames as anim}
		<button class:active={currentAnimation === anim} onclick={() => (currentAnimation = anim)}>
			{anim}
		</button>
	{/each}
</div>

<div class="container">
	<Canvas>
		<Scene {currentAnimation} />
	</Canvas>
</div>

<style>
	.container {
		width: 100%;
		height: 100vh;
	}
	.controls {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.5rem;
	}
	button {
		padding: 0.5rem 1rem;
		background: #333;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	button.active {
		background: hotpink;
	}
</style>
