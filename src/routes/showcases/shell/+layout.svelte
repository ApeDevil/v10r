<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Sidebar', href: '/showcases/shell/sidebar' },
		{ label: 'Theme', href: '/showcases/shell/theme' },
		{ label: 'Toasts', href: '/showcases/shell/toasts' },
		{ label: 'Modals', href: '/showcases/shell/modals' },
		{ label: 'Shortcuts', href: '/showcases/shell/shortcuts' },
		{ label: 'Errors', href: '/showcases/shell/errors' },
		{ label: 'Session', href: '/showcases/shell/session' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="App Shell Demo"
		description="Interactive demonstration of the app shell components and state management."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Shell' }
		]}
	/>

	<TabNav {tabs} ariaLabel="Shell sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
