<script lang="ts">
import { Stack } from '$lib/components/layout';
import { Button, Spinner, Textarea, Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import { getToast } from '$lib/state/toast.svelte';
import type { CommentStatus } from '$lib/types/db-enums';

interface PublicComment {
	id: string;
	postId: string;
	locale: string;
	authorId: string;
	authorName: string;
	body: string;
	status: CommentStatus;
	createdAt: string;
	editedAt: string | null;
}

interface ListResponse {
	data: {
		items: PublicComment[];
		nextCursor: string | null;
		crossLocaleTotals: Record<string, number>;
	};
}

interface Props {
	postId: string;
	postSlug: string;
	locale: string;
	currentUserId: string | null;
	isSignedIn: boolean;
}

let { postId, postSlug, locale, currentUserId, isSignedIn }: Props = $props();

let comments = $state<PublicComment[]>([]);
let nextCursor = $state<string | null>(null);
let totals = $state<Record<string, number>>({});
let loading = $state(true);
let loadingMore = $state(false);
let refreshTick = $state(0);
let bodyText = $state('');
let submitting = $state(false);
let editingId = $state<string | null>(null);
let editingBody = $state('');

const toast = getToast();

const COUNTER_THRESHOLD = 3200;
const MAX_LEN = 4000;

const remaining = $derived(MAX_LEN - bodyText.trim().length);
const overflowing = $derived(bodyText.trim().length > MAX_LEN);
const showCounter = $derived(bodyText.trim().length >= COUNTER_THRESHOLD);

const otherLocaleTotal = $derived(Object.entries(totals).reduce((acc, [l, n]) => (l === locale ? acc : acc + n), 0));
const currentLocaleTotal = $derived(totals[locale] ?? 0);
const otherLocalesWithCounts = $derived(
	Object.entries(totals)
		.filter(([l, n]) => l !== locale && n > 0)
		.map(([l, n]) => ({ locale: l, count: n })),
);

async function fetchPage(cursor: string | null = null) {
	const params = new URLSearchParams({ locale, limit: '20' });
	if (cursor) params.set('cursor', cursor);
	const r = await fetch(`/api/blog/posts/${postId}/comments?${params}`);
	if (!r.ok) throw new Error('comments fetch failed');
	return ((await r.json()) as ListResponse).data;
}

async function refresh() {
	try {
		loading = true;
		const data = await fetchPage();
		comments = data.items;
		nextCursor = data.nextCursor;
		totals = data.crossLocaleTotals;
	} catch {
		toast?.error('Failed to load comments');
	} finally {
		loading = false;
	}
}

async function loadMore() {
	if (!nextCursor || loadingMore) return;
	try {
		loadingMore = true;
		const data = await fetchPage(nextCursor);
		comments = [...comments, ...data.items];
		nextCursor = data.nextCursor;
	} finally {
		loadingMore = false;
	}
}

// Refresh on mount + when refreshTick changes
$effect(() => {
	refreshTick;
	refresh();
});

async function submitComment(event: SubmitEvent) {
	event.preventDefault();
	if (submitting || overflowing || bodyText.trim().length === 0) return;
	submitting = true;
	try {
		const r = await fetch(`/api/blog/posts/${postId}/comments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-requested-with': 'XMLHttpRequest' },
			body: JSON.stringify({
				locale,
				body: bodyText.trim(),
				clientNonce: crypto.randomUUID(),
			}),
		});
		if (r.ok) {
			bodyText = '';
			refreshTick++;
			toast?.success('Comment posted');
		} else {
			const data = (await r.json().catch(() => null)) as { error?: { code?: string } } | null;
			const code = data?.error?.code;
			if (code === 'comment_on_unpublished') {
				toast?.error('This post is not published in this language.');
			} else if (code === 'rate_limited') {
				toast?.error('Too many comments. Wait a moment and try again.');
			} else {
				toast?.error('Could not post comment. Please try again.');
			}
		}
	} catch {
		toast?.error('Network error. Your text is preserved.');
	} finally {
		submitting = false;
	}
}

async function deleteOwn(commentId: string) {
	const fd = new FormData();
	fd.append('commentId', commentId);
	const r = await fetch(`/blog/${postSlug}/comments?/delete`, { method: 'POST', body: fd });
	if (r.ok) {
		comments = comments.filter((c) => c.id !== commentId);
		toast?.success('Comment deleted');
	} else {
		toast?.error('Could not delete comment');
	}
}

function startEdit(c: PublicComment) {
	editingId = c.id;
	editingBody = c.body;
}

function cancelEdit() {
	editingId = null;
	editingBody = '';
}

async function saveEdit() {
	if (!editingId) return;
	const fd = new FormData();
	fd.append('commentId', editingId);
	fd.append('body', editingBody);
	const r = await fetch(`/blog/${postSlug}/comments?/edit`, { method: 'POST', body: fd });
	if (r.ok) {
		const id = editingId;
		comments = comments.map((c) => (c.id === id ? { ...c, body: editingBody, editedAt: new Date().toISOString() } : c));
		cancelEdit();
		toast?.success('Comment updated');
	} else {
		toast?.error('Could not save edit');
	}
}

const editWindowMs = 5 * 60 * 1000;
function canEdit(c: PublicComment): boolean {
	return c.authorId === currentUserId && Date.now() - new Date(c.createdAt).getTime() < editWindowMs;
}
</script>

<section id="comments" aria-label="Comments" class="comments">
	<Typography variant="h2">Comments</Typography>

	{#if currentLocaleTotal === 0 && otherLocaleTotal > 0}
		<p class="cross-locale" role="status">
			No comments in this language yet.
			{#each otherLocalesWithCounts as ol (ol.locale)}
				<a href={localizeHref(`/blog/${postSlug}`, { locale: ol.locale as 'en' | 'de' | 'ru' })}>
					View {ol.count} comment{ol.count === 1 ? '' : 's'} in {ol.locale.toUpperCase()}
				</a>
			{/each}
		</p>
	{/if}

	<!-- Composer -->
	{#if isSignedIn}
		<form onsubmit={submitComment} class="composer" aria-label="Post a comment">
			<Textarea
				bind:value={bodyText}
				placeholder="Share your thoughts…"
				rows={3}
				maxlength={MAX_LEN + 100}
				aria-label="Comment body"
				aria-invalid={overflowing}
			/>
			<div class="composer-row">
				<div class="counter" aria-live="polite">
					{#if showCounter}
						<span class:over={overflowing}>{remaining} characters left</span>
					{/if}
				</div>
				<Button type="submit" disabled={submitting || bodyText.trim().length === 0} aria-disabled={overflowing}>
					{submitting ? 'Sending…' : 'Post comment'}
				</Button>
			</div>
		</form>
	{:else}
		<div class="signin-prompt" aria-live="polite">
			<Textarea
				value=""
				disabled
				rows={3}
				aria-label="Comment body — sign in to post"
				aria-describedby="comment-signin-msg"
			/>
			<p id="comment-signin-msg" class="signin-msg">
				<a href={localizeHref(`/auth/login?returnTo=/blog/${postSlug}#comments`)}>Sign in</a>
				to join the conversation.
			</p>
		</div>
	{/if}

	<!-- List -->
	<Stack class="gap-4 mt-4">
		{#if loading}
			<Spinner label="Loading comments" />
		{:else if comments.length === 0}
			<p class="empty">Be the first to comment.</p>
		{:else}
			{#each comments as c (c.id)}
				<article class="comment" class:moderated={c.status !== 'visible'}>
					<header class="comment-head">
						<strong>{c.authorName?.trim() || 'Anonymous'}</strong>
						<time datetime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
						{#if c.editedAt}<span class="edited">(edited)</span>{/if}
						{#if c.status === 'hidden'}<span class="status-badge">Hidden by moderator</span>{/if}
						{#if c.status === 'removed'}<span class="status-badge">Removed</span>{/if}
					</header>
					{#if editingId === c.id}
						<Textarea bind:value={editingBody} rows={3} aria-label="Edit comment" />
						<div class="composer-row">
							<Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
							<Button onclick={saveEdit}>Save</Button>
						</div>
					{:else}
						<p class="comment-body">{c.body}</p>
						{#if c.authorId === currentUserId && c.status === 'visible'}
							<div class="comment-actions">
								{#if canEdit(c)}
									<Button variant="ghost" onclick={() => startEdit(c)}>Edit</Button>
								{/if}
								<Button variant="ghost" onclick={() => deleteOwn(c.id)}>Delete</Button>
							</div>
						{/if}
					{/if}
				</article>
			{/each}
			{#if nextCursor}
				<Button variant="ghost" onclick={loadMore} disabled={loadingMore}>
					{loadingMore ? 'Loading…' : 'Load more comments'}
				</Button>
			{/if}
		{/if}
	</Stack>
</section>

<style>
	.comments {
		margin-top: var(--spacing-7);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}
	.composer,
	.signin-prompt {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.composer-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
	}
	.counter {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
	.counter .over {
		color: var(--color-error);
		font-weight: 600;
	}
	.signin-msg {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}
	.signin-msg a {
		color: var(--color-primary);
	}
	.cross-locale {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
	.cross-locale a {
		color: var(--color-primary);
		margin-left: var(--spacing-2);
	}
	.empty {
		color: var(--color-muted);
		font-style: italic;
	}
	.comment {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
	}
	.comment.moderated {
		opacity: 0.6;
	}
	.comment-head {
		display: flex;
		gap: var(--spacing-2);
		align-items: baseline;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
	.comment-head strong {
		color: var(--color-fg);
	}
	.status-badge {
		font-size: 0.75rem;
		padding: 2px 6px;
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border-radius: var(--radius-sm);
	}
	.edited {
		opacity: 0.6;
	}
	.comment-body {
		margin: 0;
		white-space: pre-wrap;
		color: var(--color-fg);
	}
	.comment-actions {
		display: flex;
		gap: var(--spacing-2);
	}
</style>
