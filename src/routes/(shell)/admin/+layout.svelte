<script lang="ts">
import type { Snippet } from 'svelte';
import { TabNav } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { children }: { children: Snippet } = $props();

const groups = [
	{
		label: 'Observe',
		tabs: [
			{ label: 'DB Observation', href: '/admin/db', icon: 'i-lucide-database' },
			{ label: 'Audit Log', href: '/admin/audit', icon: 'i-lucide-shield-check' },
		],
	},
	{
		label: 'Manage',
		tabs: [
			{ label: 'Users', href: '/admin/users', icon: 'i-lucide-users' },
			{ label: 'Feature Flags', href: '/admin/flags', icon: 'i-lucide-toggle-right' },
			{ label: 'Branding', href: '/admin/branding', icon: 'i-lucide-palette' },
		],
	},
	{
		label: 'System',
		tabs: [{ label: 'Jobs', href: '/admin/jobs', icon: 'i-lucide-clock' }],
	},
];
</script>

<PageContainer class="py-7">
	<TabNav {groups} ariaLabel="Admin sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
