<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, BackLink, NavGrid } from '$lib/components/composites';
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

	<NavGrid>
		<LinkCard
			href="/showcases/shell"
			icon="i-lucide-layout"
			title="App Shell"
			description="Keyboard shortcuts, modals, toasts, session lifecycle, navigation"
		/>

		<LinkCard
			href="/showcases/ui"
			icon="i-lucide-palette"
			title="UI Components"
			description="Complete UI component library and design tokens"
		/>

		<LinkCard
			href="/showcases/forms"
			icon="i-lucide-text-cursor-input"
			title="Forms"
			description="Superforms + Valibot validation, patterns, and advanced techniques"
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
			href="/showcases/db"
			icon="i-lucide-server"
			title="Database"
			description="PostgreSQL, Neo4j, R2, Redis — connections, types, queries, and storage"
		/>

		<LinkCard
			href="/showcases/auth"
			icon="i-lucide-lock"
			title="Auth"
			description="Better Auth authentication flows"
		/>

		<LinkCard
			href="/showcases/ai"
			icon="i-lucide-bot"
			title="AI"
			description="AI assistant with Vercel AI SDK and Groq"
		/>

		<LinkCard
			href="/showcases/i18n"
			icon="i-lucide-languages"
			title="i18n"
			description="Translations, pluralization, formatting, and language switching"
		/>
	</NavGrid>

	<BackLink href="/" label="Home" />
</PageContainer>
