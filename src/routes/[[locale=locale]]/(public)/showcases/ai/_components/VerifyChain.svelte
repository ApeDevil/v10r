<script lang="ts">
import * as m from '$lib/paraglide/messages';

// The chatbot's trust gate: post-stream citation verification. The parallel slot on
// the deskbot page is ApprovalLifecycle — one question ("what makes this surface
// trustworthy?"), two answers.
const VERDICTS = [
	{ id: 'quote', icon: 'i-lucide-quote', tone: 'success' },
	{ id: 'paraphrase', icon: 'i-lucide-repeat', tone: 'success' },
	{ id: 'drifted', icon: 'i-lucide-git-compare', tone: 'warning' },
	{ id: 'uncited', icon: 'i-lucide-file-question', tone: 'error' },
] as const;
</script>

<div class="verify">
	<ol class="steps">
		<li class="step">
			<code>streamText</code>
			<span class="gloss">stream closes — the answer text is final</span>
		</li>
		<li class="step">
			<code>verifyCitations(answer, drilledChunks)</code>
			<span class="gloss">every cited source is checked against the chunks the model actually drilled this turn</span>
		</li>
		<li class="step">
			<code>llmwiki:citations</code>
			<span class="gloss">{m.showcase_ai_verify_chips()}</span>
		</li>
	</ol>
	<ul class="verdicts" aria-label={m.showcase_ai_sec_verify()}>
		{#each VERDICTS as v (v.id)}
			<li class="verdict" data-tone={v.tone}>
				<span class="{v.icon} verdict-icon" aria-hidden="true"></span>
				<code>{v.id}</code>
			</li>
		{/each}
	</ul>
</div>

<style>
	.verify {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.step {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: var(--spacing-2) 0 var(--spacing-2) var(--spacing-4);
	}

	.step::before {
		content: '';
		position: absolute;
		left: 0.4rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--color-border);
	}

	.step:first-child::before {
		top: 50%;
	}

	.step:last-child::before {
		bottom: 50%;
	}

	.step code {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
		word-break: break-all;
	}

	.gloss {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.verdicts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: var(--spacing-1) var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: 9999px;
		font-size: var(--text-fluid-xs);
	}

	.verdict-icon {
		width: 0.85rem;
		height: 0.85rem;
	}

	.verdict[data-tone='success'] .verdict-icon {
		color: var(--color-success);
	}

	.verdict[data-tone='warning'] .verdict-icon {
		color: var(--color-warning);
	}

	.verdict[data-tone='error'] .verdict-icon {
		color: var(--color-error);
	}
</style>
