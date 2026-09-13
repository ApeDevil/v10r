<script lang="ts">
import { page } from '$app/state';
import { Button, Select } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import type { TurnInspectorState } from './turn-inspector.state.svelte';

// Which turn the inspector opens: a recorded turn (anyone — the fixture, authored or
// recorded, says which it is), or one of the viewer's own conversations of this surface
// (signed in — the owner-guarded routes are the only door). The "Inspect this turn" link an
// answer carries (`?conversation=…&turn=…`) opens one directly; on the chatbot page the
// inspector otherwise follows the thread above, and this is where following is switched back on.
let { inspector, signedIn }: { inspector: TurnInspectorState; signedIn: boolean } = $props();

const loginHref = $derived(
	`${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
);

// An effect, not onMount: an "Inspect this turn" link on this very page only changes the query.
let opened = '';
$effect(() => {
	const conversation = page.url.searchParams.get('conversation');
	const turn = page.url.searchParams.get('turn');
	const key = `${conversation}/${turn}`;
	if (!signedIn || !conversation || !turn || key === opened) return;
	opened = key;
	void inspector.inspect(conversation, turn);
});

// The recorded source is named by its provenance, with its one-sentence explanation under
// the toggle — the only place on this section that says what the recorded turn is.
const recordedLabel = $derived(
	inspector.recorded.provenance.kind === 'authored' ? m.showcase_ai_prov_authored : m.showcase_ai_prov_recorded,
);
const recordedGloss = $derived(
	inspector.recorded.provenance.kind === 'authored'
		? m.showcase_ai_prov_authored_gloss
		: m.showcase_ai_prov_recorded_gloss,
);

const shorten = (text: string) => (text.length > 72 ? `${text.slice(0, 72)}…` : text);

const conversationOptions = $derived(
	inspector.conversations.map((c) => ({
		value: c.id,
		label: c.title?.trim() || new Date(c.updatedAt).toLocaleString(),
	})),
);

const turnOptions = $derived(
	inspector.turns.map((t) => ({ value: t.messageId, label: shorten(t.question) || t.createdAt })),
);

const noConversations = $derived(
	inspector.surface === 'deskbot' ? m.showcase_ai_orch_no_conversations_deskbot : m.showcase_ai_orch_no_conversations,
);

const ERROR_TEXT = {
	auth: m.showcase_ai_orch_err_auth,
	rate: m.showcase_ai_orch_err_rate,
	failed: m.showcase_ai_orch_err_failed,
} as const;
</script>

<div class="picker">
	<div class="source-toggle" role="group" aria-label={m.showcase_ai_inspector_source()}>
		<Button
			variant={inspector.source === 'recorded' ? 'secondary' : 'ghost'}
			size="sm"
			onclick={() => inspector.showRecorded()}>{recordedLabel()}</Button
		>
		<Button
			variant={inspector.source === 'live' ? 'secondary' : 'ghost'}
			size="sm"
			disabled={!signedIn}
			onclick={() => inspector.showLive()}>{m.showcase_ai_orch_src_live()}</Button
		>
		{#if signedIn && inspector.surface === 'chatbot'}
			<Button
				variant={inspector.follow && inspector.source === 'live' ? 'primary' : 'ghost'}
				size="sm"
				aria-pressed={inspector.follow}
				onclick={() => (inspector.follow ? (inspector.follow = false) : inspector.followLatest())}
			>
				<span class="i-lucide-scan-search h-4 w-4" aria-hidden="true"></span>
				{inspector.follow ? m.showcase_ai_graph_following() : m.showcase_ai_graph_follow()}
			</Button>
		{/if}
	</div>

	{#if inspector.source === 'recorded' && inspector.fixtures.length > 1}
		<!-- Several recorded turns teach several claims; each is named by its own question. -->
		<div class="fixtures" role="group" aria-label={m.showcase_ai_orch_pick_recorded()}>
			{#each inspector.fixtures as fixture, index (index)}
				<Button
					variant={inspector.fixtureIndex === index ? 'secondary' : 'ghost'}
					size="sm"
					onclick={() => inspector.showRecorded(index)}>{shorten(fixture.question)}</Button
				>
			{/each}
		</div>
	{/if}

	{#if inspector.source === 'recorded'}
		<p class="note">{recordedGloss()}</p>
	{/if}

	{#if !signedIn}
		<p class="note">
			<span class="i-lucide-lock h-3.5 w-3.5" aria-hidden="true"></span>
			{m.showcase_ai_orch_signin()}
			<a href={loginHref}>{m.showcase_ai_orch_signin_action()}</a>
		</p>
	{:else if inspector.source === 'live'}
		<div class="selects">
			<label class="field">
				<span>{m.showcase_ai_orch_pick_conversation()}</span>
				<Select
					options={conversationOptions}
					value={inspector.conversationId}
					disabled={inspector.loading || conversationOptions.length === 0}
					onchange={(id) => inspector.pickConversation(id)}
				/>
			</label>
			<label class="field">
				<span>{m.showcase_ai_orch_pick_turn()}</span>
				<Select
					options={turnOptions}
					value={inspector.messageId}
					disabled={inspector.loading || turnOptions.length === 0}
					onchange={(id) => inspector.pickTurn(id)}
				/>
			</label>
		</div>
		{#if inspector.loading}
			<p class="note">{m.showcase_ai_orch_loading()}</p>
		{:else if inspector.error}
			<p class="error" role="alert">{ERROR_TEXT[inspector.error]()}</p>
		{:else if inspector.conversations.length === 0}
			<p class="note">{noConversations()}</p>
		{:else if inspector.conversationId && inspector.turns.length === 0}
			<p class="note">{m.showcase_ai_orch_no_turns()}</p>
		{/if}
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.source-toggle,
	.fixtures {
		display: flex;
		gap: var(--spacing-1);
		flex-wrap: wrap;
	}

	.note,
	.error {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.note a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.error {
		color: var(--color-error);
	}

	.selects {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--spacing-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
