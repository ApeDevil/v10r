<script lang="ts">
import { invalidate } from '$app/navigation';
import type { ResolvedAnnouncement } from '$lib/server/admin/announcements';

interface Props {
	announcements: ResolvedAnnouncement[];
}

let { announcements }: Props = $props();

// Sort: critical first, then warning, then info
const sortOrder = { critical: 0, warning: 1, info: 2 } as const;
const sorted = $derived([...announcements].sort((a, b) => sortOrder[a.severity] - sortOrder[b.severity]));

let dismissing = $state<string | null>(null);
let dismissed = $state<Set<string>>(new Set());

async function dismiss(id: string) {
	dismissing = id;
	// Optimistic removal
	dismissed = new Set([...dismissed, id]);

	try {
		const res = await fetch(`/api/announcements/${id}/dismiss`, {
			method: 'POST',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
		});
		if (res.ok) {
			await invalidate('app:announcements');
		} else {
			// Revert optimistic removal
			const next = new Set(dismissed);
			next.delete(id);
			dismissed = next;
		}
	} catch {
		const next = new Set(dismissed);
		next.delete(id);
		dismissed = next;
	} finally {
		dismissing = null;
	}
}

const visible = $derived(sorted.filter((a) => !dismissed.has(a.id)));

const severityConfig = {
	info: {
		icon: 'i-lucide-info',
		role: 'status' as const,
		ariaLive: 'polite' as const,
	},
	warning: {
		icon: 'i-lucide-alert-triangle',
		role: 'status' as const,
		ariaLive: 'polite' as const,
	},
	critical: {
		icon: 'i-lucide-alert-octagon',
		role: 'alert' as const,
		ariaLive: 'assertive' as const,
	},
};
</script>

{#if visible.length > 0}
	<div class="announcement-stack" role="region" aria-label="System announcements">
		{#each visible as announcement (announcement.id)}
			{@const config = severityConfig[announcement.severity]}
			<div
				class="announcement-banner severity-{announcement.severity}"
				role={config.role}
				aria-live={config.ariaLive}
			>
				<span class="{config.icon} banner-icon" aria-hidden="true"></span>
				<div class="banner-content">
					<strong class="banner-title">{announcement.title}</strong>
					<span class="banner-body">{announcement.body}</span>
				</div>
				{#if announcement.severity !== 'critical'}
					<button
						class="banner-dismiss"
						aria-label="Dismiss: {announcement.title}"
						onclick={() => dismiss(announcement.id)}
						disabled={dismissing === announcement.id}
					>
						<span class="i-lucide-x dismiss-icon" aria-hidden="true"></span>
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.announcement-stack {
		display: flex;
		flex-direction: column;
	}

	.announcement-banner {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
		width: 100%;
	}

	.severity-info {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		color: var(--color-fg);
	}

	.severity-warning {
		background: color-mix(in srgb, var(--color-warning) 12%, transparent);
		color: var(--color-fg);
	}

	.severity-critical {
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-fg);
		border-left: 4px solid var(--color-error);
	}

	.banner-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.severity-info .banner-icon {
		color: var(--color-primary);
	}

	.severity-warning .banner-icon {
		color: var(--color-warning);
	}

	.severity-critical .banner-icon {
		color: var(--color-error);
	}

	.banner-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1) var(--spacing-2);
		font-size: var(--text-fluid-sm);
		line-height: 1.4;
	}

	.banner-title {
		font-weight: 600;
	}

	.banner-body {
		color: var(--color-muted);
	}

	.banner-dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--color-muted);
		border-radius: var(--radius-sm);
		flex-shrink: 0;
		padding: 0;
	}

	.banner-dismiss:hover {
		background: color-mix(in srgb, var(--color-fg) 10%, transparent);
		color: var(--color-fg);
	}

	.banner-dismiss:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.dismiss-icon {
		width: 14px;
		height: 14px;
	}
</style>
