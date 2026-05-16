<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { AppShell } from '$lib/components/shell';
import { setNotificationContext } from '$lib/state';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// svelte-ignore state_referenced_locally
setNotificationContext(data.unreadCount);

const tabs = [
	{ label: 'Dashboard', href: '/app/dashboard', icon: 'i-lucide-layout-dashboard' },
	{ label: 'Account', href: '/app/account', icon: 'i-lucide-user' },
	{ label: 'Notifications', href: '/app/notifications', icon: 'i-lucide-bell' },
];
</script>

<AppShell session={data.session} isAdmin={data.isAdmin} announcements={data.announcements}>
	<PageContainer class="py-7">
		<PageHeader
			title="App"
			description="Welcome back, {data.user.name}."
			breadcrumbs={[
				{ label: 'Home', href: '/' },
				{ label: 'App' }
			]}
		/>

		<NavTab {tabs} ariaLabel="App sections" />

		<div class="pt-6">
			{@render children()}
		</div>
	</PageContainer>
</AppShell>
