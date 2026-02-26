<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/auth/connection' },
		{ label: 'Session', href: '/showcases/auth/session' },
		{ label: 'Security', href: '/showcases/auth/security' },
	];
</script>

<ShowcaseLayout
	title="Auth"
	description="Better Auth session-based authentication — connection health, session lifecycle, and security diagnostics."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Auth' }
	]}
	{tabs}
	ariaLabel="Auth sections"
>
	{@render children()}
</ShowcaseLayout>
