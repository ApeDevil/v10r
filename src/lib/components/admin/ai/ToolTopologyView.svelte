<script lang="ts">
import { Badge } from '$lib/components/primitives';

export interface ToolRow {
	name: string;
	branch: 'retrieval' | 'desk';
	risk: 'read' | 'create' | 'write' | 'destructive';
	/** Desk tools carry their gating scope; chatbot (retrieval) tools are scopeless → null. */
	scope: string | null;
	scopeLabel: string;
	stepBudget: number;
	note: string;
}

let { tools }: { tools: ToolRow[] } = $props();

const retrievalTools = $derived(tools.filter((t) => t.branch === 'retrieval'));
const deskTools = $derived(tools.filter((t) => t.branch === 'desk'));

// Risk = text + icon + shape (never color alone) — WCAG 1.4.1.
const riskMeta: Record<ToolRow['risk'], { icon: string; variant: 'secondary' | 'success' | 'warning' | 'error' }> = {
	read: { icon: 'i-lucide-eye', variant: 'secondary' },
	create: { icon: 'i-lucide-plus', variant: 'success' },
	write: { icon: 'i-lucide-pencil', variant: 'warning' },
	destructive: { icon: 'i-lucide-trash-2', variant: 'error' },
};
</script>

<div class="topology">
	<p class="caption">
		A single chat turn runs <strong>one</strong> branch, selected by the <code>surface</code>
		discriminant (<code>chatbot</code> | <code>deskbot</code>): the chatbot's grounded-retrieval path
		returns before desk tools mount, so retrieval tools and desk tools never execute in the same turn.
		Desk tools are gated by the scopes granted to the turn.
	</p>

	{#snippet riskBadge(risk: ToolRow['risk'])}
		<Badge variant={riskMeta[risk].variant}>
			<span class="{riskMeta[risk].icon} risk-icon" aria-hidden="true"></span>{risk}
		</Badge>
	{/snippet}

	<!-- Retrieval branch -->
	<section class="group">
		<h3 class="group-title">
			<span class="i-lucide-search h-4 w-4" aria-hidden="true"></span>
			Retrieval tools
			<span class="group-sub">always-on for the <code>chatbot</code> surface · step budget 3</span>
		</h3>
		<div class="table-wrap" tabindex="0" aria-label="Retrieval tools">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Tool</th>
						<th scope="col">Risk</th>
						<th scope="col">Mounts</th>
						<th scope="col">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each retrievalTools as t (t.name)}
						<tr>
							<td><code class="tool-name">{t.name}</code></td>
							<td>{@render riskBadge(t.risk)}</td>
							<td><span class="muted">{t.scopeLabel}</span></td>
							<td class="note">{t.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Desk branch -->
	<section class="group">
		<h3 class="group-title">
			<span class="i-lucide-panel-top h-4 w-4" aria-hidden="true"></span>
			Desk tools
			<span class="group-sub">scope-gated via <code>createDeskTools</code> · step budget 3 (read) / 5 (mutation)</span>
		</h3>
		<div class="table-wrap" tabindex="0" aria-label="Desk tools">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Tool</th>
						<th scope="col">Scope</th>
						<th scope="col">Risk</th>
						<th scope="col">Steps</th>
						<th scope="col">Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each deskTools as t (t.name)}
						<tr>
							<td><code class="tool-name">{t.name}</code></td>
							<td><code class="scope">{t.scope}</code></td>
							<td>{@render riskBadge(t.risk)}</td>
							<td><code class="muted">{t.stepBudget}</code></td>
							<td class="note">{t.note}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<p class="footnote">
		<code>resolve_ref</code> is also registered whenever any tool is active — the escape hatch that
		pulls back compacted tool results (AI SDK #9631 workaround). It is infrastructure, not a
		model capability, so it is omitted from the table above.
	</p>
</div>

<style>
	.topology {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.caption {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.caption code,
	.footnote code {
		font-family: ui-monospace, monospace;
		font-size: 0.85em;
		color: var(--color-fg);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.group-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.group-sub {
		font-size: var(--text-fluid-xs);
		font-weight: 400;
		color: var(--color-muted);
	}

	.group-sub code {
		font-family: ui-monospace, monospace;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.data-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}

	.tool-name {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		font-weight: 600;
	}

	.scope {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.risk-icon {
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 0.25rem;
	}

	.muted {
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}

	.note {
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		max-width: 28ch;
	}

	.footnote {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}
</style>
