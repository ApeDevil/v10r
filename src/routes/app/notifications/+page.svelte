<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { NotificationCenter, EmptyState } from '$lib/components/composites';
	import { Button } from '$lib/components/primitives/button';
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

<div class="notification-page">
	<div class="page-actions">
		<h2 class="page-title">Notifications</h2>
		{#if data.unreadCount > 0}
			<Button variant="ghost" size="sm" onclick={handleMarkAllRead}>
				Mark all as read
			</Button>
		{/if}
		<a href="/app/notifications/settings" class="settings-link">
			<span class="i-lucide-settings" aria-hidden="true"></span>
			Settings
		</a>
	</div>

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
</div>

<style>
	.notification-page {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.page-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.page-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
		flex: 1;
	}

	.settings-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		text-decoration: none;
	}

	.settings-link:hover {
		color: var(--color-fg);
	}
</style>
