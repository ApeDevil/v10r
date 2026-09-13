<script lang="ts">
import { onMount } from 'svelte';
import { page } from '$app/state';
import { ChatInput, ChatThread } from '$lib/components/composites/chatbot';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import { citedCatalogSources } from '$lib/components/composites/chatbot/turn-progress';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { isSiteAwareRoute, resolveRouteLabel } from '$lib/search/route-id';
import type { InspectedTurn } from '$lib/showcases/ai/inspector';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';

// The working chatbot, first on the page — the SAME Vely thread the dock shows, rendered in
// place: one session, one transport, one history. While this is mounted the dock stays out
// of the way (`attachEmbeddedHost`). Signed out, the page shows the fixture's own question
// and answer as an example conversation (the section's provenance badge says so); the first
// attempt to ask opens the thread's sign-in gate instead. The answer is read at page width,
// so its prose gets more leading and paragraph room than the dock's.
let { signedIn, fixture }: { signedIn: boolean; fixture: InspectedTurn } = $props();

const session = chatbotSession;
let inputValue = $state('');
/** A signed-out visitor pressed a question: show the thread (its gate) instead of the example. */
let tried = $state(false);

const gated = $derived(session.gate === 'auth_required');
const isLoading = $derived(session.isStreaming);
const pageLabel = $derived(resolveRouteLabel(page.route.id));
const showThread = $derived(signedIn || tried);
const suggestions = $derived([m.showcase_ai_example_q1(), m.showcase_ai_example_q2(), m.showcase_ai_example_q3()]);

onMount(() => {
	const release = session.attachEmbeddedHost();
	if (signedIn) void session.open();
	return release;
});

function ask(text: string) {
	if (!text.trim() || isLoading) return;
	if (gated) {
		tried = true;
		return;
	}
	inputValue = '';
	// Frozen at click: the page Send was pressed from. Private/unknown routes send nothing.
	const routeId = page.route.id;
	session.submit(text, isSiteAwareRoute(routeId) ? (routeId ?? undefined) : undefined);
}
</script>

<div class="example">
	<div class="thread">
		{#if showThread}
			<ChatThread class="thread-body" />
		{:else}
			<div class="thread-body authored">
				<ChatMessage role="user" content={fixture.question} />
				<ChatMessage role="assistant" content={fixture.answer} catalogSources={citedCatalogSources(fixture.trace)} />
			</div>
		{/if}

		<div class="suggestions" role="group" aria-label={m.showcase_ai_example_suggested()}>
			<span class="suggestions-label">{m.showcase_ai_example_suggested()}</span>
			{#each suggestions as question (question)}
				<Button variant="outline" size="sm" disabled={isLoading} onclick={() => ask(question)}>{question}</Button>
			{/each}
		</div>

		{#if showThread}
			{#if !gated && pageLabel}
				<div class="context" data-testid="vely-page-context">
					<span class="i-lucide-map-pin h-3 w-3 shrink-0" aria-hidden="true"></span>
					<span class="truncate">{m.ai_chat_page_context({ pageLabel })}</span>
				</div>
			{/if}
			<ChatInput
				bind:value={inputValue}
				loading={isLoading}
				signedOut={gated}
				signedOutHintId="vely-example-signin-hint"
				onsubmit={() => ask(inputValue)}
				onstop={() => session.stop()}
			/>
		{/if}
	</div>
</div>

<style>
	.example {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.thread {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		overflow: hidden;
		--chat-prose-leading: 1.7;
		--chat-prose-paragraph-gap: 0.9em;
	}

	.thread :global(.thread-body) {
		min-height: 16rem;
		max-height: 60vh;
	}

	.authored {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-3) var(--spacing-2);
		overflow: auto;
	}

	.suggestions {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		padding: var(--spacing-2) var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.suggestions-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.context {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem var(--spacing-3);
		border-top: 1px solid var(--color-border);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
