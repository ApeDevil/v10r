<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { data, children }: { data: any; children: Snippet } = $props();

	const tabs = [
		{ label: 'Dashboard', href: '/app/dashboard', icon: 'i-lucide-layout-dashboard' },
		{ label: 'Account', href: '/app/account', icon: 'i-lucide-user' },
		{ label: 'Jobs', href: '/app/jobs', icon: 'i-lucide-clock' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="App"
		description="Welcome back, {data.user.name}."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'App' }
		]}
	/>

	<TabNav {tabs} ariaLabel="App sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
