<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';

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

<ShowcaseLayout
	title="App Shell Demo"
	description="Interactive demonstration of the app shell components and state management."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Shell' }
	]}
	{tabs}
	ariaLabel="Shell sections"
>
	{@render children()}
</ShowcaseLayout>
