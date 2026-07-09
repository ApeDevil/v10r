<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab, PageHeader } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import { AppShell } from '$lib/components/shell';
import * as m from '$lib/paraglide/messages';
import { setNotificationContext } from '$lib/state';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// svelte-ignore state_referenced_locally
setNotificationContext(data.unreadCount);

const tabs = [
	{ label: m.nav_dashboard(), href: '/account/dashboard', icon: 'i-lucide-layout-dashboard' },
	{ label: m.nav_settings(), href: '/account/settings', icon: 'i-lucide-settings' },
	{ label: m.nav_notifications(), href: '/account/notifications', icon: 'i-lucide-bell' },
	{ label: m.nav_security(), href: '/account/security', icon: 'i-lucide-shield-check' },
];
</script>

<AppShell session={data.session} isAdmin={data.isAdmin} announcements={data.announcements}>
	<PageContainer class="py-7">
		<PageHeader
			title={m.nav_account()}
			description={m.account_welcome({ name: data.user.name })}
			breadcrumbs={[
				{ label: m.nav_home(), href: '/' },
				{ label: m.nav_account() }
			]}
		/>

		<NavTab {tabs} ariaLabel={m.account_sections_aria()} />

		<div class="pt-6">
			{@render children()}
		</div>
	</PageContainer>
</AppShell>
