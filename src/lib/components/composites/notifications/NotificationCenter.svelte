<script lang="ts">
import type { Snippet } from 'svelte';
import NotificationCard from './NotificationCard.svelte';
import NotificationFilters from './NotificationFilters.svelte';

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
	filter: string;
	onFilterChange: (filter: string) => void;
	onMarkRead: (id: string) => void;
	/** Notification to highlight + scroll to (push-tap deep link: ?n=<id>). */
	focusId?: string | null;
	empty?: Snippet;
}

let { notifications, filter, onFilterChange, onMarkRead, focusId = null, empty }: Props = $props();

const filtered = $derived(() => {
	if (filter === 'mentions') return notifications.filter((n) => n.type === 'mention');
	if (filter === 'system') return notifications.filter((n) => n.type === 'system' || n.type === 'security');
	return notifications;
});

$effect(() => {
	if (!focusId) return;
	// Programmatic focus (not just scroll) so screen readers land on the item.
	const el = document.getElementById(`notification-${focusId}`);
	el?.scrollIntoView({ block: 'center' });
	el?.focus();
});
</script>

<div class="notification-center">
	<NotificationFilters active={filter} onchange={onFilterChange} />

	{#if filtered().length === 0}
		{#if empty}
			{@render empty()}
		{:else}
			<p class="empty-message">No notifications match this filter</p>
		{/if}
	{:else}
		<div class="notification-list" role="feed" aria-label="Notifications">
			{#each filtered() as notification (notification.id)}
				<div
					id="notification-{notification.id}"
					class="notification-focus-wrap"
					class:focused={notification.id === focusId}
					tabindex="-1"
				>
					<NotificationCard
						{...notification}
						createdAt={notification.createdAt}
						onMarkRead={onMarkRead}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.notification-center {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background-color: var(--surface-1);
		overflow: hidden;
	}

	.notification-list {
		max-height: 70vh;
		overflow-y: auto;
	}

	.notification-focus-wrap {
		outline: none;
	}

	.notification-focus-wrap.focused {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		box-shadow: inset 3px 0 0 var(--color-primary);
	}

	.empty-message {
		padding: var(--spacing-8);
		text-align: center;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}
</style>
