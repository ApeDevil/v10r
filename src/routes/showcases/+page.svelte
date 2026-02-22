<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Showcases - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
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
			href="/showcases/shell"
			icon="i-lucide-layout"
			title="App Shell"
			description="Keyboard shortcuts, modals, toasts, session lifecycle, navigation"
		/>

		<LinkCard
			href="/showcases/forms"
			icon="i-lucide-file-edit"
			title="Forms"
			description="Form validation with Valibot + Superforms"
		/>

		<LinkCard
			href="/showcases/data"
			icon="i-lucide-database"
			title="Data"
			description="Tables, pagination, filtering, and data display"
		/>

		<LinkCard
			href="/showcases/db"
			icon="i-lucide-server"
			title="Database"
			description="PostgreSQL, Neo4j, R2 — connections, types, queries, and storage"
		/>

		<LinkCard
			href="/showcases/viz"
			icon="i-lucide-bar-chart-3"
			title="Data Viz"
			description="Charts, plots, diagrams, and data visualization"
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

		<LinkCard
			href="/showcases/i18n"
			icon="i-lucide-languages"
			title="i18n"
			description="Translations, pluralization, formatting, and language switching"
		/>

		<LinkCard
			href="/showcases/ai"
			icon="i-lucide-bot"
			title="AI"
			description="AI assistant with Vercel AI SDK and Groq"
		/>
	</nav>

	<BackLink href="/" label="Home" />
</PageContainer>

<style>
	.showcase-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
