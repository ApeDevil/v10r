<script lang="ts">
import { page } from '$app/state';
import { Button } from '$lib/components/primitives/button';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { type AiErrorKind, parseAiErrorKind, type TurnError } from '$lib/types/ai-error';
import { cn } from '$lib/utils/cn';
import ChatMessage from './ChatMessage.svelte';
import { awaitingAnswer, citedCatalogSources, inspectTurnPath, traceOf, turnProgress } from './turn-progress';

// The conversation as the tab's one Vely thread shows it — the messages, the status row
// while an answer is on its way, the sign-in gate, the empty state and the turn's error —
// with none of the panel around it. The dock (`Chatbot.svelte`) and the chatbot showcase's
// embedded example both render this over the same singleton; neither owns a second thread.
interface Props {
	/** False while the host is hidden (a minimized dock): no auto-scroll work for nothing. */
	visible?: boolean;
	/** The user followed one of Vely's same-tab links; the host decides what to do (the dock minimizes). */
	onfollowlink?: () => void;
	class?: string;
}

let { visible = true, onfollowlink, class: className }: Props = $props();

const session = chatbotSession;

let scrollContainer: HTMLDivElement | undefined = $state();

const isLoading = $derived(session.isStreaming);

// Honest progress: the status row stays up until the first word arrives (the assistant frame
// opens ~0.5 s in; the answer's first token comes seconds later) and names what the turn is
// doing from the trace the server streams on the message.
const messages = $derived(session.chat?.messages ?? []);
const showStatusRow = $derived(isLoading && awaitingAnswer(messages));
const statusLabel = $derived.by(() => {
	const progress = turnProgress(messages[messages.length - 1]);
	if (progress === 'generating') return m.ai_chat_status_thinking();
	if (progress === 'catalog') return m.ai_chat_status_catalog();
	if (progress === 'retrieving') return m.ai_chat_status_docs();
	return null;
});

// The turn's failure, if any: a mid-stream `error` frame reaches the session's `onError`
// (`lastError`); a refused request lands on `chat.error`. Both carry either the server's
// `[kind] message` frame text or a wire body with an error CODE (rate_limited /
// ai_unavailable) — digits kept OR'd for transport-level failures.
const errorText = $derived(session.lastError ?? session.chat?.error?.message ?? null);
function errorKindOf(text: string): AiErrorKind | null {
	const kind = parseAiErrorKind(text);
	if (kind) return kind;
	if (text.includes('rate_limited') || text.includes('429')) return 'rate_limit';
	if (text.includes('ai_unavailable') || text.includes('503')) return 'unavailable';
	return null;
}
// A `[kind]`-prefixed text is the server's classification of a PROVIDER failure (the
// model's 429, not this user's); the guard's own refusal comes as a wire code instead.
// The two rate limits get different words: only one of them is the user's doing.
function rateLimitCopy(text: string): string {
	return parseAiErrorKind(text) === 'rate_limit' ? m.ai_chat_error_provider_limited() : m.ai_chat_error_rate_limited();
}

// Sign-in gate — sourced from the singleton (set pre-emptively by AppShell's setUser
// and reactively by the transport on a live 401), NEVER from getSession(): the context
// copy in this subtree is frozen at mount and no auth transition updates it here.
const gated = $derived(session.gate === 'auth_required');
// Query appended AFTER localizeHref (SessionMonitor's shape); the login server load
// sanitizes returnTo and re-localizes it idempotently.
const loginHref = $derived(
	`${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
);

// Auto-scroll to the latest message (only while the host shows it).
$effect(() => {
	const len = session.chat?.messages.length ?? 0;
	if (len && scrollContainer && visible) {
		requestAnimationFrame(() => {
			if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
		});
	}
});

// Report when the user follows one of Vely's links (same-tab, primary-button, same-origin)
// so the host can step aside before the destination page renders. Fired synchronously
// BEFORE navigation; we do NOT preventDefault — SvelteKit's <a> nav proceeds. Attached
// as a real listener (not an inline handler) to keep the messages container a plain,
// non-interactive scroll region.
function onMessagesClick(e: MouseEvent) {
	if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const a = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
	if (!a || a.target === '_blank' || a.origin !== location.origin) return;
	onfollowlink?.();
}

$effect(() => {
	const el = scrollContainer;
	if (!el) return;
	el.addEventListener('click', onMessagesClick);
	return () => el.removeEventListener('click', onMessagesClick);
});
</script>

<div class={cn('flex min-h-0 flex-1 flex-col', className)}>
	<!-- Messages -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto">
		{#if messages.length > 0}
			<div class="flex flex-col gap-1 py-2">
				{#each messages as message (message.id)}
					{@const inspectPath = inspectTurnPath('chatbot', session.conversationId, message)}
					<ChatMessage
						role={message.role as 'user' | 'assistant'}
						parts={message.parts}
						catalogSources={citedCatalogSources(traceOf(message))}
						turnError={(message as { metadata?: { turnError?: TurnError } }).metadata?.turnError}
						inspectHref={inspectPath && localizeHref(inspectPath)}
					/>
				{/each}

				{#if showStatusRow}
					<div class="flex items-center gap-3 px-4 py-3" role="status" aria-live="polite">
						<div class="chatbot-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
							<span class="i-lucide-bot h-4 w-4"></span>
						</div>
						<div class="chatbot-typing flex items-center gap-2">
							<span class="flex gap-1">
								<span class="chatbot-dot"></span>
								<span class="chatbot-dot"></span>
								<span class="chatbot-dot"></span>
							</span>
							{#if statusLabel}
								<span class="text-fluid-xs text-muted">{statusLabel}</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{:else if gated}
			<!-- Pre-emptive sign-in gate: the discovery surface stays open, the failing
			     request never fires. Lock icon (not message-circle) so the state reads
			     "action needed", not "no messages yet". -->
			<div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
				<span class="i-lucide-lock h-10 w-10 text-muted"></span>
				<p class="text-fluid-sm text-fg">{m.ai_chat_signin_gate()}</p>
				<Button
					variant="primary"
					size="lg"
					class="w-full max-w-xs justify-center"
					href={loginHref}
					onclick={() => session.markReopenIntent()}
				>
					{m.ai_chat_signin_action()}
				</Button>
				<!-- AI Act Art. 50(1) first-interaction disclosure — kept in the gated
				     state too; the obligation doesn't wait for sign-in. -->
				<div class="mt-1 max-w-xs rounded-md border border-border px-3 py-2 text-left">
					<p class="text-fluid-sm text-fg">{m.ai_disclosure_notice()}</p>
					<p class="mt-1 text-fluid-xs text-muted">{m.ai_disclosure_no_personal_data()}</p>
				</div>
			</div>
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
				<span class="i-lucide-message-circle h-10 w-10 text-muted"></span>
				<p class="text-fluid-sm text-muted">{m.ai_chat_empty_prompt()}</p>
				<!-- AI Act Art. 50(1) first-interaction disclosure. Deliberately NOT
				     text-muted micro-copy: the obligation is to inform "clearly and
				     distinguishably", and the Commission Guidelines call out tiny,
				     low-contrast text as failing that. Keep it text-fg and boxed. -->
				<div class="mt-1 max-w-xs rounded-md border border-border px-3 py-2 text-left">
					<p class="text-fluid-sm text-fg">{m.ai_disclosure_notice()}</p>
					<p class="mt-1 text-fluid-xs text-muted">{m.ai_disclosure_no_personal_data()}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Sign-in / error display. Gate precedence: a live 401 sets BOTH the gate and
	     chat.error, so the auth branch must win. With no messages the empty-state
	     gate already carries the CTA; this alert covers only a thread that lost its
	     session mid-conversation (anon users can never have messages). -->
	{#if gated}
		{#if (session.chat?.messages.length ?? 0) > 0}
			<div class="chatbot-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
				<span class="font-medium">{m.errors_auth_session_expired()}</span>
				<a class="underline" href={loginHref} onclick={() => session.markReopenIntent()}>
					{m.ai_chat_signin_action()}
				</a>
			</div>
		{/if}
	{:else if errorText}
		{@const kind = errorKindOf(errorText)}
		<div class="chatbot-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert" aria-live="polite">
			<span class="font-medium">{m.ai_chat_error_heading()}</span>
			{#if kind === 'rate_limit'}
				{rateLimitCopy(errorText)}
			{:else if kind === 'unavailable' || kind === 'timeout'}
				{m.ai_chat_error_unavailable()}
			{:else}
				{m.ai_chat_error_generic()}
			{/if}
		</div>
	{/if}
</div>

<style>
	.chatbot-avatar {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.chatbot-error {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
	}

	/* Typing indicator dots */
	.chatbot-typing {
		padding: 8px 12px;
		border-radius: 8px;
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.chatbot-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-muted);
		animation: chatbot-bounce 1.4s infinite ease-in-out both;
	}

	.chatbot-dot:nth-child(1) { animation-delay: -0.32s; }
	.chatbot-dot:nth-child(2) { animation-delay: -0.16s; }

	@keyframes chatbot-bounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}

	@media (prefers-reduced-motion: reduce) {
		.chatbot-dot {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
