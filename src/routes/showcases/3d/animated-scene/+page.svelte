<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components';
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';

	let currentAnimation = $state('Survey');
	const animationNames = ['Survey', 'Walk', 'Run'];
</script>

<svelte:head>
	<title>Animated Scene - 3D - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Animated Scene"
		description="Fox model with switchable animations and orbit controls."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: '3D', href: '/showcases/3d' },
			{ label: 'Animated Scene' }
		]}
	/>
</div>

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
