<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Auth - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Auth"
		description="Better Auth session-based authentication — connection health, session lifecycle, and security diagnostics."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Auth' }
		]}
	/>

	<nav class="nav-grid">
		<LinkCard
			href="/showcases/auth/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Auth system health check, session status, provider config, and adapter diagnostics"
		/>
		<LinkCard
			href="/showcases/auth/session"
			icon="i-lucide-clock"
			title="Session"
			description="Session lifecycle, cookie cache status, auto-renewal, and expiry diagnostics"
		/>
		<LinkCard
			href="/showcases/auth/security"
			icon="i-lucide-shield"
			title="Security"
			description="Security headers, rate limiting, trusted origins, and CSRF protection"
		/>
	</nav>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
