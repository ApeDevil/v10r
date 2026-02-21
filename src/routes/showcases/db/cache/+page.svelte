<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Cache - Database - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Cache"
		description="Upstash Redis key-value store — TTL-governed ephemeral data, counters, rate limiting, and multiple data structures."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Cache' }
		]}
	/>

	<nav class="nav-grid">
		<LinkCard
			href="/showcases/db/cache/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Redis health check, PING latency, key count, and seed data management"
		/>
		<LinkCard
			href="/showcases/db/cache/patterns"
			icon="i-lucide-layers"
			title="Patterns"
			description="Strings, hashes, counters, sorted sets, and lists — all Redis data types in action"
		/>
		<LinkCard
			href="/showcases/db/cache/ephemeral"
			icon="i-lucide-timer"
			title="Ephemeral"
			description="TTL countdown, sliding expiry, rate limiting — the paradigm where disappearance is a feature"
		/>
	</nav>

	<BackLink href="/showcases/db" label="Database" />
</PageContainer>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
