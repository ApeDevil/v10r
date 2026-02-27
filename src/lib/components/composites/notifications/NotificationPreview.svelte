<script lang="ts">
	import NotificationCard from './NotificationCard.svelte';

	interface Notification {
		id: string;
		type: string;
		title: string;
		body?: string | null;
		actionUrl?: string | null;
		isRead: boolean;
		createdAt: string;
	}

	interface Props {
		notifications: Notification[];
		onMarkRead: (id: string) => void;
	}

	let { notifications, onMarkRead }: Props = $props();
</script>

<div class="notification-preview">
	<div class="preview-header">
		<span class="preview-title">Notifications</span>
		<a href="/app/notifications" class="preview-link">View all</a>
	</div>

	{#if notifications.length === 0}
		<p class="preview-empty">No new notifications</p>
	{:else}
		{#each notifications.slice(0, 5) as notification (notification.id)}
			<NotificationCard
				{...notification}
				createdAt={notification.createdAt}
				{onMarkRead}
			/>
		{/each}
	{/if}
</div>

<style>
	.notification-preview {
		width: 22rem;
		max-height: 26rem;
		overflow-y: auto;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.preview-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.preview-link {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		text-decoration: none;
	}

	.preview-link:hover {
		text-decoration: underline;
	}

	.preview-empty {
		padding: var(--spacing-6);
		text-align: center;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
</style>
