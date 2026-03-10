<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, NavGrid, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>3D Showcase - Velociraptor</title>
</svelte:head>

<PageContainer width="default" class="pt-7">
	<PageHeader
		title="3D Showcase"
		description="Three.js + Threlte 3D demonstrations with GLTF models, animations, and interactive controls."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: '3D' }
		]}
	/>

	<NavGrid>
		<LinkCard
			href="/showcases/3d/static-scene"
			icon="i-lucide-box"
			title="Static Scene"
			description="GLTF model (DamagedHelmet) with orbit controls and lighting"
		/>
		<LinkCard
			href="/showcases/3d/animated-scene"
			icon="i-lucide-play"
			title="Animated Scene"
			description="Fox model with animation controls (Survey, Walk, Run)"
		/>
	</NavGrid>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>
