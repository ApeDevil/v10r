<script lang="ts">
import { invalidate } from '$app/navigation';
import { EmptyState, NotificationCenter } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, buttonVariants } from '$lib/components/primitives/button';
import * as m from '$lib/paraglide/messages';
import { getNotifications, getToast } from '$lib/state';

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
		toast.success(m.app_notifications_marked_read({ count }));
		await invalidate('app:notifications');
	}
}
</script>

<Stack gap="5">
	<Cluster justify="between">
		<h2 class="text-fluid-lg font-semibold">{m.app_notifications_heading()}</h2>
		<Cluster gap="3">
			{#if data.unreadCount > 0}
				<Button variant="ghost" size="sm" onclick={handleMarkAllRead}>
					{m.app_notifications_mark_all_read()}
				</Button>
			{/if}
			<a href="/app/notifications/settings" class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
				<span class="i-lucide-settings" aria-hidden="true"></span>
				{m.app_notifications_settings()}
			</a>
		</Cluster>
	</Cluster>

	{#if data.notifications.length === 0 && filter === 'all'}
		<EmptyState
			icon="i-lucide-bell-off"
			title={m.app_notifications_empty_title()}
			description={m.app_notifications_empty_description()}
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
