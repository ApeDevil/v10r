<script lang="ts">
	import { registerPanelMenus } from '$lib/components/composites/dock';
	import { getIOLogEntries, clearIOLog, type IOLogEntry } from '$lib/components/composites/dock/io-log.svelte';
	import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';

	interface Props {
		panelId: string;
	}

	let { panelId }: Props = $props();

	const entries = $derived(getIOLogEntries());

	let scrollEl: HTMLDivElement | undefined = $state();

	// Auto-scroll to bottom on new entries
	$effect(() => {
		const count = entries.length;
		if (count && scrollEl) {
			requestAnimationFrame(() => {
				if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
			});
		}
	});

	function badgeClass(entry: IOLogEntry): string {
		switch (entry.source) {
			case 'context-read': return 'badge-read';
			case 'tool-call': return 'badge-tool';
			case 'tool-result': return entry.level === 'error' ? 'badge-error' : 'badge-write';
			case 'effect': return 'badge-effect';
			case 'progress': return 'badge-progress';
			default: return '';
		}
	}

	function badgeLabel(entry: IOLogEntry): string {
		switch (entry.source) {
			case 'context-read': return 'READ';
			case 'tool-call': return 'CALL';
			case 'tool-result': return entry.level === 'error' ? 'ERR' : 'DONE';
			case 'effect': return 'FX';
			case 'progress': return 'STEP';
			default: return '?';
		}
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
	}

	// ── Panel menus ─────────────────────────────────────────────────

	const logMenus = $derived<MenuBarMenu[]>([
		{
			label: 'Log',
			items: [
				{ label: 'Clear', icon: 'i-lucide-trash-2', onSelect: clearIOLog },
			],
		},
	]);

	$effect(() => {
		return registerPanelMenus(panelId, { menuBar: logMenus });
	});
</script>

<div class="io-log-panel">
	<div class="io-log-scroll" bind:this={scrollEl}>
		{#if entries.length === 0}
			<div class="io-log-empty">
				<span class="i-lucide-activity io-log-empty-icon"></span>
				<p>No activity yet</p>
			</div>
		{:else}
			{#each entries as entry (entry.id)}
				<div class="io-log-entry">
					<span class="io-log-time">{formatTime(entry.timestamp)}</span>
					<span class="io-log-badge {badgeClass(entry)}">{badgeLabel(entry)}</span>
					{#if entry.toolName}
						<span class="io-log-tool">{entry.toolName}</span>
					{/if}
					<span class="io-log-label">{entry.label}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.io-log-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--desk-panel-bg, var(--color-bg));
	}

	.io-log-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
		font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
		font-size: 11px;
	}

	.io-log-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 8px;
		color: var(--color-muted);
		font-size: 13px;
		font-family: inherit;
	}

	.io-log-empty-icon {
		font-size: 28px;
		opacity: 0.4;
	}

	.io-log-entry {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 8px;
		line-height: 1.6;
	}

	.io-log-entry:hover {
		background: color-mix(in srgb, var(--color-muted) 6%, transparent);
	}

	.io-log-time {
		color: var(--color-muted);
		opacity: 0.6;
		flex-shrink: 0;
	}

	.io-log-badge {
		display: inline-block;
		padding: 0 4px;
		border-radius: 3px;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.5px;
		flex-shrink: 0;
		line-height: 16px;
	}

	.badge-read {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.badge-tool {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
	}

	.badge-write {
		background: color-mix(in srgb, var(--color-warning) 15%, transparent);
		color: var(--color-warning);
	}

	.badge-error {
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 15%, transparent);
		color: var(--color-error-fg, #ef4444);
	}

	.badge-effect {
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		color: var(--color-muted);
	}

	.badge-progress {
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
		color: var(--color-muted);
	}

	.io-log-tool {
		color: var(--color-fg);
		font-weight: 500;
	}

	.io-log-label {
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
