<script lang="ts">
import type { Snippet } from 'svelte';
import { TabNav } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';

let { children }: { children: Snippet } = $props();

const tabs = [
	{ label: 'DB Observation', href: '/admin/db', icon: 'i-lucide-database' },
	{ label: 'Branding', href: '/admin/branding', icon: 'i-lucide-palette' },
	{ label: 'Jobs', href: '/admin/jobs', icon: 'i-lucide-clock' },
];
</script>

<PageContainer class="py-7">
	<TabNav {tabs} ariaLabel="Admin sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
