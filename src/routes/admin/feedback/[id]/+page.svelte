<script lang="ts">
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { BackLink, Card, ConfirmDialog } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Tag } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n/formatting';

let { data }: PageProps = $props();

let confirmDeleteOpen = $state(false);

function statusVariant(status: string) {
	if (status === 'new') return 'default' as const;
	if (status === 'read') return 'success' as const;
	return 'secondary' as const;
}
</script>
<Stack gap="6">
	<BackLink href="/admin/feedback" label="feedback" />

	<header class="detail-header">
		<div>
			<h1 class="detail-title">{data.item.subject}</h1>
			<p class="detail-meta">
				<span>{formatRelative(data.item.submittedAt)}</span>
				<span aria-hidden="true">·</span>
				<code>{data.item.pageOfOrigin}</code>
				{#if data.item.rating != null}
					<span aria-hidden="true">·</span>
					<span>Rating: {data.item.rating}/5</span>
				{/if}
			</p>
		</div>
		<Tag variant={statusVariant(data.item.status)} size="md">{data.item.status}</Tag>
	</header>

	{#if data.item.contactEmail}
		<Card>
			<div class="contact-row">
				<span class="contact-label">Reply to</span>
				<a class="contact-email" href={`mailto:${data.item.contactEmail}?subject=Re: ${encodeURIComponent(data.item.subject)}`}>
					{data.item.contactEmail}
				</a>
			</div>
		</Card>
	{/if}

	<Card>
		<h2 class="card-h2">Message</h2>
		<p class="message-body">{data.item.body}</p>
	</Card>

	<Card>
		<h2 class="card-h2">Session journey</h2>
		{#if data.item.sessionId && data.journey.events.length > 0}
			<p class="journey-meta">
				Session <code>{data.item.sessionId}</code>{#if data.journey.session?.startedAt}
					· started {formatRelative(data.journey.session.startedAt)}
				{/if}
			</p>
			<ol class="journey-list">
				{#each data.journey.events as ev, i (i)}
					<li>
						<span class="journey-time">{formatRelative(ev.timestamp)}</span>
						<code class="journey-path">{ev.path}</code>
						<span class="muted">{ev.eventType}</span>
					</li>
				{/each}
			</ol>
		{:else if data.item.sessionId}
			<p class="muted">Session linked, but no events recorded (events may have been cleaned up).</p>
		{:else}
			<p class="muted">No journey linked — this user did not consent to analytics tracking.</p>
		{/if}
	</Card>

	<div class="actions">
		<form method="POST" action="?/updateStatus" use:enhance class="inline-form">
			{#if data.item.status !== 'archived'}
				<Button type="submit" name="status" value="archived" variant="outline" size="md">Archive</Button>
			{:else}
				<Button type="submit" name="status" value="new" variant="outline" size="md">Reopen</Button>
			{/if}
		</form>

		<Button variant="ghost" size="md" onclick={() => (confirmDeleteOpen = true)}>Delete</Button>
	</div>

	<ConfirmDialog
		bind:open={confirmDeleteOpen}
		title="Delete this feedback?"
		description="This permanently removes the message. There's no undo."
		confirmLabel="Delete"
		destructive
		onconfirm={async () => {
			const res = await fetch(`/admin/feedback/${data.item.id}?/delete`, {
				method: 'POST',
				headers: { 'x-requested-with': 'fetch' },
			});
			if (res.ok) goto('/admin/feedback');
		}}
		oncancel={() => (confirmDeleteOpen = false)}
	/>
</Stack>

<style>
	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.detail-title {
		margin: 0;
		font-size: var(--text-fluid-xl, 1.25rem);
		font-weight: 600;
	}

	.detail-meta {
		margin: var(--spacing-1) 0 0 0;
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.card-h2 {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.contact-row {
		display: flex;
		gap: var(--spacing-3);
		align-items: baseline;
	}

	.contact-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.contact-email {
		font-size: var(--text-fluid-base);
		color: var(--color-primary);
	}

	.message-body {
		margin: 0;
		white-space: pre-wrap;
		font-size: var(--text-fluid-base);
		color: var(--color-fg);
		line-height: 1.6;
	}

	.journey-meta {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.journey-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.journey-list li {
		display: grid;
		grid-template-columns: 9rem 1fr auto;
		gap: var(--spacing-3);
		align-items: baseline;
		font-size: var(--text-fluid-sm);
	}

	.journey-time {
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.journey-path {
		color: var(--color-fg);
	}

	.muted {
		color: var(--color-muted);
	}

	.actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.inline-form {
		display: inline;
	}
</style>
