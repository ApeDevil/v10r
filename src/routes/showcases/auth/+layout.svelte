<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/auth/connection' },
		{ label: 'Session', href: '/showcases/auth/session' },
		{ label: 'Security', href: '/showcases/auth/security' },
	];
</script>

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

	<TabNav {tabs} ariaLabel="Auth sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
