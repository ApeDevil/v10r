<script lang="ts">
import { Card, EmptyState } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Button, Tag } from '#lib/components/primitives/index.ts';
import { feedbackCategoryLabel, submitterStatusLabel } from '#lib/feedback/labels.ts';
import { formatRelative, localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { page } from '$app/state';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
</script>

<Stack gap="5">
	<header class="feedback-header">
		<div>
			<h2 class="feedback-title">{m.account_feedback_title()}</h2>
			<p class="feedback-lede">{m.account_feedback_lede()}</p>
		</div>
		<Button href={localizeHref('/feedback')} variant="outline" size="sm">{m.account_feedback_send()}</Button>
	</header>

	{#if data.items.length === 0}
		<EmptyState title={m.account_feedback_empty_title()} description={m.account_feedback_empty_description()} icon="i-lucide-message-square" />
	{:else}
		<Card>
			<ul class="feedback-list">
				{#each data.items as item (item.id)}
					<li class="feedback-row">
						<div class="feedback-main">
							<span class="feedback-subject">{item.subject}</span>
							<span class="feedback-meta">
								{feedbackCategoryLabel(item.category)} · {formatRelative(new Date(item.submittedAt), page.data.locale)}
							</span>
						</div>
						<Tag variant={item.status === 'closed' ? 'secondary' : 'default'} size="sm">{submitterStatusLabel(item.status)}</Tag>
					</li>
				{/each}
			</ul>
		</Card>
		{#if data.offset + data.items.length < data.total}
			<Button href={`?offset=${data.offset + data.limit}`} variant="ghost" size="sm">{m.account_feedback_more()}</Button>
		{/if}
	{/if}
</Stack>

<style>
	.feedback-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.feedback-title {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}

	.feedback-lede {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.feedback-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.feedback-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.feedback-row:last-child {
		border-bottom: none;
	}

	.feedback-main {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.feedback-subject {
		color: var(--color-fg);
		overflow-wrap: anywhere;
	}

	.feedback-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
