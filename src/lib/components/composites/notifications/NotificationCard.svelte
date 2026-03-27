<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	id: string;
	type: string;
	title: string;
	body?: string | null;
	actionUrl?: string | null;
	isRead: boolean;
	createdAt: string;
	onMarkRead?: (id: string) => void;
	class?: string;
}

let { id, type, title, body, actionUrl, isRead, createdAt, onMarkRead, class: className }: Props = $props();

const iconMap: Record<string, string> = {
	mention: 'i-lucide-at-sign',
	comment: 'i-lucide-message-square',
	system: 'i-lucide-info',
	success: 'i-lucide-check-circle',
	security: 'i-lucide-shield-alert',
	follow: 'i-lucide-user-plus',
};

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
</script>

<article class={cn('notification-card', !isRead && 'unread', className)}>
	<div class="notification-icon" aria-hidden="true">
		<span class={iconMap[type] ?? 'i-lucide-bell'}></span>
	</div>

	<div class="notification-content">
		{#if actionUrl}
			<a href={actionUrl} class="notification-title">{title}</a>
		{:else}
			<p class="notification-title">{title}</p>
		{/if}

		{#if body}
			<p class="notification-body">{body}</p>
		{/if}

		<time class="notification-time" datetime={createdAt}>{timeAgo(createdAt)}</time>
	</div>

	{#if !isRead && onMarkRead}
		<button
			class="mark-read-btn"
			onclick={() => onMarkRead(id)}
			aria-label="Mark as read"
		>
			<span class="i-lucide-check"></span>
		</button>
	{/if}
</article>

<style>
	.notification-card {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.notification-card.unread {
		background-color: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.notification-icon {
		flex-shrink: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		/* Optical alignment with text baseline */
		padding-top: 2px;
	}

	.notification-content {
		flex: 1;
		min-width: 0;
	}

	.notification-title {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin: 0;
		text-decoration: none;
	}

	a.notification-title:hover {
		text-decoration: underline;
	}

	.notification-body {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		margin: var(--spacing-1) 0 0;
		line-height: 1.5;
	}

	.notification-time {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		opacity: 0.7;
	}

	.mark-read-btn {
		flex-shrink: 0;
		padding: var(--spacing-2);
		border: none;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.mark-read-btn:hover {
		color: var(--color-primary);
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}
</style>
