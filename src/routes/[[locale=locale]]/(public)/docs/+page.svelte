<script lang="ts">
import { LinkCard } from '$lib/components';
import { BackLink, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
</script>
<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="Documentation"
		description="Reference docs for how Velociraptor is built — stack decisions, architecture patterns, and the principles behind them."
		breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs' }]}
	/>

	<nav class="docs-nav">
		<LinkCard
			href="/docs/foundation"
			icon="i-lucide-compass"
			title="Foundation"
			description="Understand why this project exists before touching a line of code."
		/>
		<LinkCard
			href="/docs/stack"
			icon="i-lucide-layers"
			title="Stack"
			description="Every tool, why it was chosen, and how to use it."
		/>
		<LinkCard
			href="/docs/blueprint"
			icon="i-lucide-map"
			title="Blueprint"
			description="Cross-cutting patterns: auth, data, notifications, AI, deployment."
		/>
	</nav>

	<BackLink href="/" label="Home" />
</PageContainer>

<style>
	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--spacing-6);
		margin-bottom: var(--spacing-7);
	}
</style>
