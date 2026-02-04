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
		top: var(--spacing-4);
		left: var(--spacing-4);
		z-index: var(--z-sidebar);
		display: flex;
		gap: var(--spacing-2);
	}
	button {
		padding: var(--spacing-2) var(--spacing-4);
		background: var(--color-subtle);
		color: var(--color-fg);
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	button.active {
		background: var(--color-primary);
		color: var(--color-bg);
	}
</style>
