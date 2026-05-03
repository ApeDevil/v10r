<script lang="ts">
import { Canvas } from '@threlte/core';
import { BackLink, PageHeader } from '$lib/components';
import { BoundaryFallback } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import Scene from './Scene.svelte';

let currentAnimation = $state('Survey');
const animationNames = ['Survey', 'Walk', 'Run'];
</script>
<div class="page">
	<PageHeader
		title={m.showcase_3d_animated_title()}
		description={m.showcase_3d_animated_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_3d_breadcrumb(), href: '/showcases/3d' },
			{ label: m.showcase_3d_animated_breadcrumb() }
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

<svelte:boundary>
	<div class="container">
		<Canvas>
			<Scene {currentAnimation} />
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
	<BackLink href="/showcases/3d" label={m.showcase_3d_breadcrumb()} />
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
		z-index: 5;
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
