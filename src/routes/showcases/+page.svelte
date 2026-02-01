<script lang="ts">
	import { PageHeader } from '$lib/components/composites';
	import { LinkCard } from '$lib/components/ui';
</script>

<svelte:head>
	<title>Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Showcases"
		description="Feature demonstrations and examples showing the capabilities of the Velociraptor stack."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases' }
		]}
	/>

	<nav class="showcase-nav">
		<LinkCard
			href="/showcases/ui"
			icon="i-lucide-palette"
			title="UI Components"
			description="Complete UI component library and design tokens"
		/>

		<LinkCard
			href="/showcases/blueprint"
			icon="i-lucide-layout"
			title="App Shell Blueprint"
			description="Keyboard shortcuts, modals, toasts, navigation"
		/>

		<LinkCard
			href="/showcases/forms"
			icon="i-lucide-file-edit"
			title="Forms"
			description="Form validation with Valibot + Superforms"
		/>

		<LinkCard
			href="/showcases/3d"
			icon="i-lucide-box"
			title="3D"
			description="Three.js + Threlte 3D scenes"
		/>

		<LinkCard
			href="/showcases/auth"
			icon="i-lucide-lock"
			title="Auth"
			description="Better Auth authentication flows"
		/>
	</nav>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.showcase-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}
</style>
