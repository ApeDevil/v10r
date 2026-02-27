<script lang="ts">
	import { getNotifications } from '$lib/state';
	import { NotificationBadge } from '$lib/components/composites/notifications';

	const notifs = getNotifications();

	let eventSource: EventSource | null = $state(null);
	let retryDelay = $state(1000);

	function connect() {
		if (typeof window === 'undefined') return;

		const es = new EventSource('/api/notifications/stream');
		eventSource = es;

		es.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'init') {
					notifs.setCount(data.unreadCount);
				} else if (data.type === 'new') {
					notifs.increment();
				}
				retryDelay = 1000;
			} catch {
				// Ignore malformed events
			}
		};

		es.onerror = () => {
			es.close();
			eventSource = null;
			// Exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
			setTimeout(connect, retryDelay);
			retryDelay = Math.min(retryDelay * 2, 30_000);
		};
	}

	$effect(() => {
		connect();
		return () => {
			eventSource?.close();
		};
	});
</script>

<a href="/app/notifications" class="notification-trigger" aria-label="Notifications">
	<span class="i-lucide-bell notification-icon" aria-hidden="true"></span>
	<NotificationBadge count={notifs.unreadCount} />
</a>

<style>
	.notification-trigger {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-2);
		color: var(--color-muted);
		text-decoration: none;
		border-radius: var(--radius-md);
	}

	.notification-trigger:hover {
		color: var(--color-fg);
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.notification-icon {
		font-size: 1.25rem;
	}

	.notification-trigger :global(.notification-badge) {
		position: absolute;
		top: -2px;
		right: -4px;
	}
</style>
