<script lang="ts">
	import { getIOLogTurns, markAllRead, clearIOLog } from '$lib/components/composites/dock/desk-io-log.svelte';
	import { registerPanelMenus } from '$lib/components/composites/dock';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	// Mark all read when the panel mounts
	$effect(() => {
		markAllRead();
	});

	const turns = $derived(getIOLogTurns());
	const reversedTurns = $derived([...turns].reverse());

	let expandedTurns = $state(new Set<string>());

	function toggleTurn(turnId: string) {
		const next = new Set(expandedTurns);
		if (next.has(turnId)) {
			next.delete(turnId);
		} else {
			next.add(turnId);
		}
		expandedTurns = next;
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	}

	function formatArgs(args: Record<string, unknown> | undefined): string {
		if (!args) return '';
		try {
			return JSON.stringify(args, null, 2);
		} catch {
			return String(args);
		}
	}

	// ── Panel menus ─────────────────────────────────────────────────

	const logMenus = $derived<MenuBarMenu[]>([
		{
			label: 'Log',
			items: [
				{
					label: 'Clear Log',
					icon: 'i-lucide-trash-2',
					onSelect: () => clearIOLog(),
				},
			],
		},
	]);

	$effect(() => {
		return registerPanelMenus(panelId, { menuBar: logMenus });
	});
</script>

<div class="io-log-panel">
	{#if reversedTurns.length === 0}
		<div class="io-log-empty">
			<span class="i-lucide-scroll-text io-log-empty-icon"></span>
			<p>No AI tool activity yet.</p>
		</div>
	{:else}
		<div class="io-log-list">
			{#each reversedTurns as turn (turn.turnId)}
				{@const toolCalls = turn.entries.filter((e) => e.kind === 'tool-call')}
				{@const isExpanded = expandedTurns.has(turn.turnId)}

				<button
					class="io-log-turn-header"
					class:expanded={isExpanded}
					onclick={() => toggleTurn(turn.turnId)}
				>
					<span class="io-log-turn-chevron" class:rotated={isExpanded}>
						<span class="i-lucide-chevron-right"></span>
					</span>
					<span class="io-log-turn-time">{formatTime(turn.startedAt)}</span>
					<span class="io-log-turn-summary">
						{toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
					</span>
				</button>

				{#if isExpanded}
					<div class="io-log-entries">
						{#each turn.entries as entry (entry.id)}
							<div class="io-log-entry io-log-entry--{entry.kind}">
								<span class="io-log-entry-icon">
									{#if entry.kind === 'tool-call'}
										<span class="i-lucide-wrench"></span>
									{:else if entry.kind === 'tool-result'}
										<span class="i-lucide-check"></span>
									{:else if entry.kind === 'error'}
										<span class="i-lucide-alert-circle"></span>
									{:else}
										<span class="i-lucide-eye"></span>
									{/if}
								</span>

								<div class="io-log-entry-body">
									<div class="io-log-entry-header">
										<span class="io-log-entry-kind">{entry.kind}</span>
										{#if entry.toolName}
											<span class="io-log-entry-tool">{entry.toolName}</span>
										{/if}
										<span class="io-log-entry-time">{formatTime(entry.timestamp)}</span>
									</div>

									{#if entry.kind === 'tool-call' && entry.args}
										<pre class="io-log-entry-detail">{formatArgs(entry.args)}</pre>
									{/if}

									{#if entry.kind === 'tool-result' && entry.result}
										<div class="io-log-entry-result">{entry.result}</div>
									{/if}

									{#if entry.kind === 'error' && entry.error}
										<div class="io-log-entry-error">{entry.error}</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.io-log-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		background: var(--color-bg);
		font-size: 12px;
	}

	.io-log-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
		color: var(--color-muted);
	}

	.io-log-empty-icon {
		font-size: 24px;
		opacity: 0.4;
	}

	.io-log-list {
		display: flex;
		flex-direction: column;
	}

	.io-log-turn-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: none;
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		color: var(--color-fg);
		cursor: pointer;
		text-align: left;
		font-size: 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.io-log-turn-header:hover {
		background: color-mix(in srgb, var(--color-muted) 14%, transparent);
	}

	.io-log-turn-chevron {
		font-size: 11px;
		transition: transform 100ms;
		opacity: 0.5;
	}

	.io-log-turn-chevron.rotated {
		transform: rotate(90deg);
	}

	.io-log-turn-time {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}

	.io-log-turn-summary {
		color: var(--color-muted);
	}

	.io-log-entries {
		border-bottom: 1px solid var(--color-border);
	}

	.io-log-entry {
		display: flex;
		gap: 8px;
		padding: 6px 12px 6px 24px;
		border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
	}

	.io-log-entry-icon {
		flex-shrink: 0;
		font-size: 12px;
		padding-top: 1px;
		opacity: 0.6;
	}

	.io-log-entry--tool-call .io-log-entry-icon { color: var(--color-primary); }
	.io-log-entry--tool-result .io-log-entry-icon { color: var(--color-success, #22c55e); }
	.io-log-entry--error .io-log-entry-icon { color: var(--color-error-fg, #ef4444); }

	.io-log-entry-body {
		flex: 1;
		min-width: 0;
	}

	.io-log-entry-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.io-log-entry-kind {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.5;
	}

	.io-log-entry-tool {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-primary);
	}

	.io-log-entry-time {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}

	.io-log-entry-detail {
		margin: 4px 0 0;
		padding: 4px 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.5;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.io-log-entry-result {
		margin-top: 2px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.io-log-entry-error {
		margin-top: 2px;
		font-size: 11px;
		color: var(--color-error-fg, #ef4444);
	}
</style>
