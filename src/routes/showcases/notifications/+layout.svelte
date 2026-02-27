<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Send', href: '/showcases/notifications/send' },
		{ label: 'Pipeline', href: '/showcases/notifications/pipeline' },
		{ label: 'Channels', href: '/showcases/notifications/channels' },
	];
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
