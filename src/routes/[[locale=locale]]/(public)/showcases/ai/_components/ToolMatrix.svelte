<script lang="ts">
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { buildToolCards, toolCounts } from '$lib/showcase/ai/topology';
import type { AiSurfaceId } from '$lib/types/ai-tools';

// Manifest-derived, never hand-copied: rows come from TOOL_MANIFEST via
// buildToolCards(), so a renamed tool updates this page in the same commit.
let { surface }: { surface: AiSurfaceId } = $props();

const cards = buildToolCards();
const own = cards.filter((c) => c.surface === surface);
const sibling = cards.filter((c) => c.surface !== surface);
const counts = toolCounts();
const ownCount = surface === 'chatbot' ? counts.chatbot : counts.deskbot;
const otherCount = surface === 'chatbot' ? counts.deskbot : counts.chatbot;

const RISK_META: Record<string, { icon: string; variant: 'secondary' | 'success' | 'warning' | 'error' }> = {
	read: { icon: 'i-lucide-eye', variant: 'secondary' },
	create: { icon: 'i-lucide-plus', variant: 'success' },
	write: { icon: 'i-lucide-pencil', variant: 'warning' },
	destructive: { icon: 'i-lucide-trash-2', variant: 'error' },
};
</script>

<div class="matrix">
	<!-- The set glyph: emptiness is the claim, and a table cannot render emptiness.
	     Counts are DOM text — the picture decorates the sentence, not the reverse. -->
	<p class="glyph-line">
		<svg viewBox="0 0 120 44" class="glyph" aria-hidden="true">
			<circle cx="30" cy="22" r="18" fill="none" stroke="var(--color-primary)" stroke-width="2" />
			<circle cx="90" cy="22" r="18" fill="none" stroke="var(--color-accent, var(--color-fg))" stroke-width="2" />
			<text x="30" y="27" text-anchor="middle" fill="var(--color-fg)" font-size="13">{counts.chatbot}</text>
			<text x="90" y="27" text-anchor="middle" fill="var(--color-fg)" font-size="13">{counts.deskbot}</text>
			<text x="60" y="27" text-anchor="middle" fill="var(--color-muted)" font-size="11">0</text>
		</svg>
		<span class="glyph-text">{m.showcase_ai_tools_shared_line({ own: String(ownCount), other: String(otherCount) })}</span>
	</p>

	<div class="table-wrap" tabindex="0" aria-label={m.showcase_ai_sec_tools()}>
		<table>
			<thead>
				<tr>
					<th scope="col">{m.showcase_ai_tools_col_tool()}</th>
					<th scope="col">{m.showcase_ai_tools_col_risk()}</th>
					<th scope="col">{m.showcase_ai_tools_col_scope()}</th>
					<th scope="col">{m.showcase_ai_tools_col_gate()}</th>
				</tr>
			</thead>
			<tbody>
				{#each own as card (card.name)}
					{@const risk = RISK_META[card.risk] ?? RISK_META.read}
					<tr>
						<td><code class="tool-name">{card.name}</code></td>
						<td>
							<Badge variant={risk.variant}>
								<span class="{risk.icon} risk-icon" aria-hidden="true"></span>{card.risk}
							</Badge>
						</td>
						<td>
							{#if card.scope}
								<code class="scope">{card.scope}</code>
							{:else}
								<span class="none" aria-hidden="true">—</span>
								<span class="visually-hidden">none</span>
							{/if}
						</td>
						<td class="gate-cell">
							{#if !card.mutating}
								<span class="none" aria-hidden="true">—</span>
								<span class="visually-hidden">read-only</span>
							{:else if card.requiresApproval}
								<span class="gate-approval">
									<span class="i-lucide-user-check h-3.5 w-3.5" aria-hidden="true"></span>
									{m.showcase_ai_tools_approval()}
								</span>
							{:else}
								<span class="gate-inloop">{m.showcase_ai_tools_inloop()}</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- The absent set, shown: zero overlap is verifiable at a glance, not asserted. -->
	<details class="sibling">
		<summary>{m.showcase_ai_tools_sibling()} · {sibling.length}</summary>
		<ul class="sibling-list">
			{#each sibling as card (card.name)}
				<li><code>{card.name}</code></li>
			{/each}
		</ul>
	</details>

	<p class="footnote">{m.showcase_ai_tools_scope_footnote()}</p>
</div>

<style>
	.matrix {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.glyph-line {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin: 0;
		flex-wrap: wrap;
	}

	.glyph {
		width: 7.5rem;
		height: 2.75rem;
		flex-shrink: 0;
	}

	.glyph-text {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}

	.tool-name {
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.scope {
		font-size: var(--text-fluid-xs);
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
	}

	.risk-icon {
		width: 0.8rem;
		height: 0.8rem;
		margin-right: 0.25rem;
		vertical-align: -0.1em;
	}

	.none {
		color: var(--color-muted);
	}

	.gate-cell {
		white-space: nowrap;
	}

	.gate-approval {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--text-fluid-xs);
		color: var(--color-warning);
		font-weight: 600;
	}

	.gate-inloop {
		font-size: var(--text-fluid-xs);
		color: var(--color-success);
	}

	.sibling summary {
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.sibling-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin: var(--spacing-2) 0 0 0;
		padding: 0;
		opacity: 0.75;
	}

	.sibling-list code {
		font-size: var(--text-fluid-xs);
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
	}

	.footnote {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
