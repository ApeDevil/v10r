<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/notifications');
</script>

<ShowcaseLayout
	title="Notifications"
	description="Multi-channel notification system — in-app SSE, email via Resend, Telegram bot, and Discord OAuth2 DM."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Notifications' }
	]}
	{tabs}
	ariaLabel="Notification sections"
>
	{@render children()}
</ShowcaseLayout>
