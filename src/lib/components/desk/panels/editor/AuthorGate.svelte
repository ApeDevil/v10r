<script lang="ts">
import { page } from '$app/state';
import { Stack } from '$lib/components/layout';
import { Button, Textarea, Typography } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

interface Props {
	children: import('svelte').Snippet;
}

let { children }: Props = $props();

const toast = getToast();
const granted = $derived(page.data.blogAuthor?.granted ?? false);
const isAdmin = $derived(page.data.isAdmin ?? false);
const hasPending = $derived(!!page.data.blogAuthor?.pendingRequest);
const allowed = $derived(granted || isAdmin);

let requesting = $state(false);
let cancelling = $state(false);
let message = $state('');

async function requestAccess(event: SubmitEvent) {
	event.preventDefault();
	requesting = true;
	try {
		const fd = new FormData();
		if (message.trim()) fd.append('message', message.trim());
		const r = await fetch('/desk?/requestBlogAccess', { method: 'POST', body: fd });
		if (r.ok) {
			toast?.success('Request sent. An admin will review it.');
			// Force layout reload via navigation so page.data.blogAuthor.pendingRequest updates.
			location.reload();
		} else {
			const data = (await r.json().catch(() => null)) as { code?: string } | null;
			if (data?.code === 'grant_request_pending') {
				toast?.info('You already have a pending request.');
			} else {
				toast?.error('Could not submit request.');
			}
		}
	} finally {
		requesting = false;
	}
}

async function cancelRequest() {
	cancelling = true;
	try {
		const r = await fetch('/desk?/cancelBlogAccessRequest', { method: 'POST', body: new FormData() });
		if (r.ok) {
			toast?.success('Request cancelled.');
			location.reload();
		} else {
			toast?.error('Could not cancel request.');
		}
	} finally {
		cancelling = false;
	}
}
</script>

{#if allowed}
	{@render children()}
{:else}
	<div class="gate" role="region" aria-label="Editor access">
		<Stack class="gap-4">
			<span class="i-lucide-pen-off icon" aria-hidden="true"></span>
			<Typography variant="h2">Editor access required</Typography>
			<p class="body">
				Writing blog posts requires the blog-author capability. You can request access from an admin.
			</p>
			{#if hasPending}
				<p class="status" aria-live="polite">Your request is pending review.</p>
				<Button variant="ghost" onclick={cancelRequest} disabled={cancelling}>
					{cancelling ? 'Cancelling…' : 'Cancel request'}
				</Button>
			{:else}
				<form class="form" onsubmit={requestAccess}>
					<Textarea
						bind:value={message}
						placeholder="(Optional) Note to the admin"
						rows={3}
						maxlength={500}
						aria-label="Optional note to admin"
					/>
					<Button type="submit" disabled={requesting}>
						{requesting ? 'Sending…' : 'Request access'}
					</Button>
				</form>
			{/if}
		</Stack>
	</div>
{/if}

<style>
	.gate {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-7);
		width: 100%;
		height: 100%;
		text-align: center;
	}
	.icon {
		font-size: 2.5rem;
		color: var(--color-muted);
		display: inline-block;
	}
	.body {
		color: var(--color-muted);
		max-width: 36ch;
	}
	.status {
		color: var(--color-muted);
		font-style: italic;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		max-width: 36ch;
	}
</style>
