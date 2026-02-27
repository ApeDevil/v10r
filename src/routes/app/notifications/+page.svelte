<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { NotificationCenter, EmptyState } from '$lib/components/composites';
	import { Button } from '$lib/components/primitives/button';
	import { buttonVariants } from '$lib/components/primitives/button';
	import { Stack, Cluster } from '$lib/components/layout';
	import { getNotifications } from '$lib/state';
	import { getToast } from '$lib/state';

	let { data } = $props();

	const notifs = getNotifications();
	const toast = getToast();
	let filter = $state('all');

	async function handleMarkRead(id: string) {
		const res = await fetch(`/api/notifications/${id}/read`, {
			method: 'POST',
			headers: { 'X-Requested-With': 'fetch' },
		});
		if (res.ok) {
			notifs.decrementBy(1);
			await invalidate('app:notifications');
		}
	}

	async function handleMarkAllRead() {
		const res = await fetch('/api/notifications/read-all', {
			method: 'POST',
			headers: { 'X-Requested-With': 'fetch' },
		});
		if (res.ok) {
			const { count } = await res.json();
			notifs.decrementBy(count);
			toast.success(`Marked ${count} notifications as read`);
			await invalidate('app:notifications');
		}
	}
</script>

<Stack gap="5">
	<Cluster justify="between">
		<h2 class="text-fluid-lg font-semibold">Notifications</h2>
		<Cluster gap="3">
			{#if data.unreadCount > 0}
				<Button variant="ghost" size="sm" onclick={handleMarkAllRead}>
					Mark all as read
				</Button>
			{/if}
			<a href="/app/notifications/settings" class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
				<span class="i-lucide-settings" aria-hidden="true"></span>
				Settings
			</a>
		</Cluster>
	</Cluster>

	{#if data.notifications.length === 0 && filter === 'all'}
		<EmptyState
			icon="i-lucide-bell-off"
			title="No notifications"
			description="You're all caught up. Notifications will appear here when there's something new."
		/>
	{:else}
		<NotificationCenter
			notifications={data.notifications}
			{filter}
			onFilterChange={(f) => filter = f}
			onMarkRead={handleMarkRead}
		/>
	{/if}
</Stack>
