<script lang="ts">
import { Alert, BackLink, Card, ConfirmDialog } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Button, Input, Tag, Textarea } from '#lib/components/primitives/index.ts';
import { feedbackCategoryLabel, feedbackCloseReasonLabel, feedbackStatusLabel } from '#lib/feedback/labels.ts';
import { formatRelative, localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { PageProps } from './$types';
import DevelopmentPanel from './DevelopmentPanel.svelte';

let { data, form }: PageProps = $props();

let confirmDeleteOpen = $state(false);
let note = $state(data.item.triageNote ?? '');
let duplicateTarget = $state('');

const can = $derived(new Set(data.allowedActions));

function pasteReason(reason: string): string {
	switch (reason) {
		case 'too_long':
			return m.admin_feedback_paste_too_long();
		case 'block_missing':
			return m.admin_feedback_paste_block_missing();
		case 'block_repeated':
			return m.admin_feedback_paste_block_repeated();
		case 'block_too_long':
			return m.admin_feedback_paste_block_too_long();
		case 'not_json':
			return m.admin_feedback_paste_not_json();
		case 'wrong_feedback':
			return m.admin_feedback_paste_wrong_feedback();
		case 'wrong_branch':
			return m.admin_feedback_paste_wrong_branch();
		case 'wrong_sha':
			return m.admin_feedback_paste_wrong_sha();
		case 'release_failed':
			return m.admin_feedback_paste_release_failed();
		default:
			return m.admin_feedback_paste_invalid();
	}
}

/** Which fields of a pasted block failed validation: shown as plain text. */
const pasteIssues = $derived(form && 'issues' in form && Array.isArray(form.issues) ? (form.issues as string[]) : []);

const refusalText = $derived.by(() => {
	const refusal = form && 'refusal' in form ? form.refusal : null;
	const reason = form && 'reason' in form ? String(form.reason) : '';
	if (refusal === 'slot_taken') return m.admin_feedback_refusal_slot_taken();
	if (refusal === 'invalid_scope') return m.admin_feedback_refusal_invalid_scope();
	if (refusal === 'invalid_branch') return m.admin_feedback_refusal_invalid_branch();
	if (refusal === 'branch_taken') return m.admin_feedback_refusal_branch_taken();
	if (refusal === 'report_rejected') return m.admin_feedback_refusal_report_rejected({ reason: pasteReason(reason) });
	if (refusal === 'receipt_rejected') return m.admin_feedback_refusal_receipt_rejected({ reason: pasteReason(reason) });
	if (refusal === 'stale_review') return m.admin_feedback_refusal_stale_review();
	if (refusal === 'not_releasable') return m.admin_feedback_refusal_not_releasable();
	if (refusal === 'needs_maintainer_confirmation') return m.admin_feedback_refusal_needs_maintainer_confirmation();
	if (refusal === 'invalid_transition') return m.admin_feedback_refusal_invalid_transition();
	if (refusal === 'invalid_duplicate_target') return m.admin_feedback_refusal_duplicate_target();
	if (refusal === 'has_duplicates') return m.admin_feedback_refusal_has_duplicates();
	if (refusal === 'engineering_state') return m.admin_feedback_refusal_engineering_state();
	if (refusal) return m.admin_feedback_refusal_generic();
	return null;
});
</script>
<Stack gap="6">
	<BackLink href="/admin/feedback" label={m.admin_feedback_back_label()} />

	<header class="detail-header">
		<div>
			<h1 class="detail-title">{data.item.subject || m.admin_feedback_erased_subject()}</h1>
			<p class="detail-meta">
				<span>{formatRelative(data.item.submittedAt, page.data.locale)}</span>
				<span aria-hidden="true">·</span>
				<span>{feedbackCategoryLabel(data.item.category)}</span>
				{#if data.item.userId}
					<span aria-hidden="true">·</span>
					<span>{m.admin_feedback_signed_in()}</span>
				{/if}
				{#if data.item.rating != null}
					<span aria-hidden="true">·</span>
					<span>{m.admin_feedback_rating_label({ rating: data.item.rating })}</span>
				{/if}
			</p>
		</div>
		<Tag variant={data.item.status === 'closed' ? 'secondary' : 'default'} size="md">
			{feedbackStatusLabel(data.item.status)}{#if data.item.closeReason}&nbsp;· {feedbackCloseReasonLabel(data.item.closeReason)}{/if}
		</Tag>
	</header>

	{#if data.item.erasedAt}
		<Alert variant="info" title={m.admin_feedback_erased_title()} description={m.admin_feedback_erased_description()} />
	{/if}

	{#if refusalText}
		<Alert variant="warning" title={refusalText}>
			{#if pasteIssues.length > 0}
				<ul class="issue-list">
					{#each pasteIssues as issue (issue)}<li><code>{issue}</code></li>{/each}
				</ul>
			{/if}
		</Alert>
	{/if}

	<DevelopmentPanel
		status={data.item.status}
		erased={data.item.erasedAt !== null}
		development={data.development}
		brief={data.brief}
		handoff={data.handoff}
		activeDevelopmentId={data.activeDevelopmentId}
		developmentAttempts={data.item.developmentAttempts}
		releaseBlockers={data.releaseBlockers}
	/>

	{#if data.item.contactEmail}
		<Card>
			<div class="contact-row">
				<span class="contact-label">{m.admin_feedback_reply_to()}</span>
				<a class="contact-email" href={`mailto:${data.item.contactEmail}?subject=Re: ${encodeURIComponent(data.item.subject)}`}>
					{data.item.contactEmail}
				</a>
			</div>
		</Card>
	{/if}

	<Card>
		<h2 class="card-h2">{m.admin_feedback_message_heading()}</h2>
		<p class="message-body">{data.item.body}</p>
	</Card>

	<Card>
		<h2 class="card-h2">{m.admin_feedback_context_heading()}</h2>
		<dl class="context-grid">
			<dt>{m.admin_feedback_context_page()}</dt>
			<dd><code>{data.item.pageOfOrigin || '—'}</code></dd>
			<dt>{m.admin_feedback_context_area()}</dt>
			<dd><code>{data.item.routeId ?? '—'}</code></dd>
			<dt>{m.admin_feedback_context_version()}</dt>
			<dd><code>{data.item.appVersion ?? '—'}</code></dd>
			<dt>{m.admin_feedback_context_error()}</dt>
			<dd><code>{data.item.errorId ?? '—'}</code></dd>
		</dl>
	</Card>

	<Card>
		<h2 class="card-h2">{m.admin_feedback_triage_heading()}</h2>
		<Stack gap="4">
			{#if data.item.duplicateOf}
				<p class="muted">
					{m.admin_feedback_duplicate_of()}
					<a href={`/admin/feedback/${data.item.duplicateOf}`}><code>{data.item.duplicateOf}</code></a>
				</p>
			{:else if data.item.closeReason === 'duplicate'}
				<p class="muted">{m.admin_feedback_duplicate_target_gone()}</p>
			{/if}

			{#if data.allowedActions.length > 0}
				<form method="POST" action="?/transition" use:enhance class="action-row">
					{#if can.has('accept')}
						<Button type="submit" name="kind" value="accept" variant="primary" size="sm">{m.admin_feedback_action_accept()}</Button>
					{/if}
					{#if can.has('defer')}
						<Button type="submit" name="kind" value="defer" variant="outline" size="sm">{m.admin_feedback_action_defer()}</Button>
					{/if}
					{#if can.has('reopen')}
						<Button type="submit" name="kind" value="reopen" variant="outline" size="sm">{m.admin_feedback_action_reopen()}</Button>
					{/if}
				</form>
				{#if can.has('close')}
					<form method="POST" action="?/transition" use:enhance class="action-row">
						<input type="hidden" name="kind" value="close" />
						<Button type="submit" name="reason" value="rejected" variant="outline" size="sm">{m.admin_feedback_action_reject()}</Button>
						<Button type="submit" name="reason" value="archived" variant="outline" size="sm">{m.admin_feedback_action_archive()}</Button>
					</form>
				{/if}
				{#if can.has('mark_duplicate')}
					<form method="POST" action="?/transition" use:enhance class="action-row">
						<input type="hidden" name="kind" value="mark_duplicate" />
						<Input
							name="duplicateOf"
							bind:value={duplicateTarget}
							placeholder="fbk_…"
							aria-label={m.admin_feedback_duplicate_input_label()}
							class="duplicate-input"
						/>
						<Button type="submit" variant="outline" size="sm" disabled={!duplicateTarget.trim()}>
							{m.admin_feedback_action_mark_duplicate()}
						</Button>
					</form>
				{/if}
			{:else}
				<p class="muted">{m.admin_feedback_no_triage_actions()}</p>
			{/if}

			<form method="POST" action="?/note" use:enhance class="note-form">
				<label class="contact-label" for="triage-note">{m.admin_feedback_note_label()}</label>
				<Textarea id="triage-note" name="note" bind:value={note} rows={3} maxlength={2000} />
				<div class="action-row">
					<Button type="submit" variant="ghost" size="sm">{m.admin_feedback_note_save()}</Button>
					{#if form && 'noteSaved' in form}<span class="muted">{m.admin_feedback_note_saved()}</span>{/if}
				</div>
			</form>
		</Stack>
	</Card>

	<Card>
		<h2 class="card-h2">{m.admin_feedback_related_heading()}</h2>
		{#if data.related.length === 0}
			<p class="muted">{m.admin_feedback_related_none()}</p>
		{:else}
			<ul class="related-list">
				{#each data.related as rel (rel.id)}
					<li>
						<a href={`/admin/feedback/${rel.id}`} class="related-link">{rel.subject || m.admin_feedback_erased_subject()}</a>
						<span class="muted">
							{feedbackCategoryLabel(rel.category)} · {feedbackStatusLabel(rel.status)} · {formatRelative(rel.submittedAt, page.data.locale)}
							{#if rel.sameError}· {m.admin_feedback_related_same_error()}{/if}
						</span>
						{#if can.has('mark_duplicate')}
							<form method="POST" action="?/transition" use:enhance class="inline-form">
								<input type="hidden" name="kind" value="mark_duplicate" />
								<input type="hidden" name="duplicateOf" value={rel.id} />
								<Button type="submit" variant="ghost" size="sm">{m.admin_feedback_action_duplicate_of_this()}</Button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card>
		<h2 class="card-h2">{m.admin_feedback_journey_heading()}</h2>
		{#if data.item.sessionId && data.journey.events.length > 0}
			<p class="journey-meta">
				{#if data.journey.session?.startedAt}
					{m.admin_feedback_journey_meta({ sessionId: data.item.sessionId, when: formatRelative(data.journey.session.startedAt, page.data.locale) })}
				{:else}
					{m.admin_feedback_journey_meta_no_when({ sessionId: data.item.sessionId })}
				{/if}
			</p>
			<ol class="journey-list">
				{#each data.journey.events as ev, i (i)}
					<li>
						<span class="journey-time">{formatRelative(ev.timestamp, page.data.locale)}</span>
						<code class="journey-path">{ev.path}</code>
						<span class="muted">{ev.eventType}</span>
					</li>
				{/each}
			</ol>
		{:else if data.item.sessionId}
			<p class="muted">{m.admin_feedback_journey_no_events()}</p>
		{:else}
			<p class="muted">{m.admin_feedback_journey_no_consent()}</p>
		{/if}
	</Card>

	{#if data.canDelete}
		<div class="actions">
			<Button variant="ghost" size="md" onclick={() => (confirmDeleteOpen = true)}>{m.admin_action_delete()}</Button>
		</div>
	{/if}

	<ConfirmDialog
		bind:open={confirmDeleteOpen}
		title={m.admin_feedback_delete_dialog_title()}
		description={m.admin_feedback_delete_dialog_description()}
		confirmLabel={m.admin_feedback_delete_dialog_confirm()}
		destructive
		onconfirm={async () => {
			const res = await fetch(`/admin/feedback/${data.item.id}?/delete`, {
				method: 'POST',
				body: new FormData(),
				headers: { 'x-requested-with': 'fetch' },
			});
			const outcome = await res.json().catch(() => null);
			if (res.ok && outcome?.type === 'success') goto(localizeHref('/admin/feedback'));
			else confirmDeleteOpen = false;
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

	.issue-list {
		margin: var(--spacing-2) 0 0 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-xs);
	}

	.action-row {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		align-items: center;
	}

	.action-row :global(.duplicate-input) {
		max-width: 16rem;
	}

	.note-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.context-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-2) var(--spacing-4);
		margin: 0;
		font-size: var(--text-fluid-sm);
	}

	.context-grid dt {
		color: var(--color-muted);
	}

	.context-grid dd {
		margin: 0;
		word-break: break-all;
	}

	.related-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.related-list li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		align-items: baseline;
	}

	.related-link {
		color: var(--color-fg);
	}
</style>
