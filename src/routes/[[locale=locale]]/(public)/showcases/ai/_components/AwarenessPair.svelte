<script lang="ts">
import * as m from '$lib/paraglide/messages';
import type { AiSurfaceId } from '$lib/types/ai-tools';

// Physical size IS the encoding: strip the labels and the claim survives. The
// asymmetry (thin route label vs. rich desk state) is design, not a parity gap.
let { surface }: { surface: AiSurfaceId } = $props();
</script>

<div class="pair" data-surface={surface}>
	<figure class="block block-site" data-own={surface === 'chatbot'}>
		<figcaption>site-awareness · chatbot</figcaption>
		<pre><code>&lt;current-page route="/showcases/ai/chatbot"
  kind="showcase"&gt;
AI chatbot architecture
&lt;/current-page&gt;</code></pre>
		<p class="gloss">{m.showcase_ai_aware_site()}</p>
	</figure>

	<figure class="block block-desk" data-own={surface === 'deskbot'}>
		<figcaption>desk-awareness · deskbot</figcaption>
		<pre><code>&lt;desk-context&gt;
  &lt;panel type="markdown" label="todo.md" status="open" level="full"&gt;
    # Todo
    - [ ] rotate the demo key sk-live-… → [REDACTED]
    - [ ] archive finished items into done.md
    - [x] rename Q3 sheet
    …(≤8000 chars per panel, XML-escaped)
  &lt;/panel&gt;
  &lt;panel type="spreadsheet" label="budget.xlsx" status="open" level="summary"&gt;
    3 sheets · 214 rows · last edited today
  &lt;/panel&gt;
&lt;/desk-context&gt;
&lt;desk-layout&gt;
  - todo.md (markdown) [demo_file_1]
  - budget.xlsx (spreadsheet) [demo_file_2]
&lt;/desk-layout&gt;</code></pre>
		<p class="gloss">{m.showcase_ai_aware_desk()}</p>
		<p class="redact">
			<span class="i-lucide-eraser h-3.5 w-3.5" aria-hidden="true"></span>
			{m.showcase_ai_aware_redacted()}
		</p>
	</figure>
</div>

<style>
	.pair {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: var(--spacing-3);
		align-items: start;
	}

	@media (max-width: 640px) {
		.pair {
			grid-template-columns: 1fr;
		}
	}

	.block {
		margin: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.block[data-own='true'] {
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
	}

	figcaption {
		padding: var(--spacing-1) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-subtle) 60%, transparent);
	}

	pre {
		margin: 0;
		padding: var(--spacing-3);
		overflow-x: auto;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		background: var(--color-bg);
	}

	.gloss {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
		border-top: 1px solid var(--color-border);
	}

	.redact {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: 0;
		padding: 0 var(--spacing-3) var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
