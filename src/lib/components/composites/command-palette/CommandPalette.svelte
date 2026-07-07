<script lang="ts">
import { Command as CommandPrimitive, Dialog } from 'bits-ui';
import { goto } from '$app/navigation';
import { Kbd } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n/runtime';
import { layerStack } from '$lib/state/layer-stack.svelte';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';
import {
	commandEmptyVariants,
	commandGroupHeadingVariants,
	commandInputVariants,
	commandItemVariants,
	commandListVariants,
	commandShortcutVariants,
} from '../command/command';
import { commandPaletteContentVariants, commandPaletteOverlayVariants } from './command-palette';
import type { CommandPaletteItem } from './types';

interface Props {
	open: boolean;
	items: CommandPaletteItem[];
	/** Current query text (bindable so a parent can drive a live search engine). */
	query?: string;
	placeholder?: string;
	/**
	 * 'filter' (default): the palette filters ALL items by the query (self-contained,
	 * e.g. the showcase demo). 'search': command items (panel/action/recent) are
	 * filtered; search surfaces (page/showcase/section/doc/blog) arrive pre-matched.
	 */
	mode?: 'filter' | 'search';
	/** Server lane in flight (search mode) — shows a loading row. */
	loading?: boolean;
}

let {
	open = $bindable(false),
	items,
	query = $bindable(''),
	placeholder = 'Search pages, docs, blog, panels…',
	mode = 'filter',
	loading = false,
}: Props = $props();

// Relative elevation — one rung above the surface this palette was opened from.
const s = useSurface();

const COMMAND_TYPES = new Set(['recent', 'panel', 'action']);

// Register as a dismissal layer while open — bits-ui Dialog owns its own Escape;
// registration is for hand-rolled layers underneath (drawer) to know they're not top.
$effect(() => {
	if (open) {
		layerStack.push('command-palette');
		return () => layerStack.pop('command-palette');
	}
});

// Group items for display. Command items are always filtered by the query;
// search-surface items are filtered in 'filter' mode but rendered as-is in
// 'search' mode (they were already matched by the engine).
let grouped = $derived.by(() => {
	const q = query.trim().toLowerCase();
	const matchesText = (i: CommandPaletteItem) =>
		!q || i.label.toLowerCase().includes(q) || (i.hint?.toLowerCase().includes(q) ?? false);

	const command = (type: CommandPaletteItem['type']) => items.filter((i) => i.type === type && matchesText(i));
	const surface = (type: CommandPaletteItem['type']) => {
		const arr = items.filter((i) => i.type === type);
		return mode === 'search' ? arr : arr.filter(matchesText);
	};

	if (!q) {
		// Launcher view: recents + panels + actions only.
		return {
			recent: command('recent'),
			pages: [] as CommandPaletteItem[],
			showcase: [] as CommandPaletteItem[],
			section: [] as CommandPaletteItem[],
			doc: [] as CommandPaletteItem[],
			blog: [] as CommandPaletteItem[],
			panel: command('panel'),
			action: command('action'),
		};
	}

	return {
		recent: command('recent'),
		pages: surface('page').slice(0, 6),
		showcase: surface('showcase').slice(0, 5),
		section: surface('section').slice(0, 5),
		doc: surface('doc').slice(0, 5),
		blog: surface('blog').slice(0, 5),
		panel: command('panel').slice(0, 4),
		action: command('action').slice(0, 3),
	};
});

let groups = $derived(
	[
		{ key: 'recent', heading: 'Recent', items: grouped.recent },
		{ key: 'pages', heading: 'Pages', items: grouped.pages },
		{ key: 'showcase', heading: 'Showcases', items: grouped.showcase },
		{ key: 'section', heading: 'Elements', items: grouped.section },
		{ key: 'doc', heading: 'Docs', items: grouped.doc },
		{ key: 'blog', heading: 'Blog', items: grouped.blog },
		{ key: 'panel', heading: 'Panels', items: grouped.panel },
		{ key: 'action', heading: 'Actions', items: grouped.action },
	].filter((g) => g.items.length > 0),
);

let total = $derived(groups.reduce((n, g) => n + g.items.length, 0));
let hasQuery = $derived(query.trim().length > 0);

/** Split a snippet into plain + highlighted segments (no `{@html}`). */
function segments(snippet: string, highlight?: [number, number][]) {
	if (!highlight || highlight.length === 0) return [{ text: snippet, mark: false }];
	const out: { text: string; mark: boolean }[] = [];
	let pos = 0;
	for (const [s, e] of highlight) {
		if (s > pos) out.push({ text: snippet.slice(pos, s), mark: false });
		out.push({ text: snippet.slice(s, e), mark: true });
		pos = e;
	}
	if (pos < snippet.length) out.push({ text: snippet.slice(pos), mark: false });
	return out;
}

function close() {
	open = false;
	query = '';
}

function handleSelect(item: CommandPaletteItem) {
	close();
	if (item.href) {
		goto(item.href);
	} else if (item.action) {
		item.action();
	}
}

function handleSecondary(item: CommandPaletteItem) {
	close();
	item.secondary?.action();
}

function goToSearchPage() {
	const q = query.trim();
	if (!q) return;
	close();
	goto(localizeHref(`/search?q=${encodeURIComponent(q)}`));
}

// Reset query when the palette opens.
$effect(() => {
	if (open) query = '';
});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={commandPaletteOverlayVariants()} />
		<Dialog.Content {...s.attrs} class={commandPaletteContentVariants()}>
			<CommandPrimitive.Root
				class="flex flex-col"
				shouldFilter={false}
			>
				<div class="cp-input-row flex items-center gap-3 px-4 py-3">
					<span class="i-lucide-search h-5 w-5 text-muted shrink-0" ></span>
					<CommandPrimitive.Input
						{placeholder}
						class={cn(commandInputVariants(), 'flex-1')}
						autofocus
						bind:value={query}
					/>
					{#if loading}
						<span class="i-lucide-loader-circle h-4 w-4 text-muted shrink-0 animate-spin" aria-hidden="true"></span>
					{/if}
					<Kbd keys="Esc" size="sm" />
				</div>

				<CommandPrimitive.List class={cn(commandListVariants(), 'p-2 flex flex-col gap-2')}>
					{#if hasQuery && total === 0 && !loading}
						<CommandPrimitive.Empty class={commandEmptyVariants()}>
							No results found.
						</CommandPrimitive.Empty>
					{/if}

					{#each groups as group (group.key)}
						<CommandPrimitive.Group>
							<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
								{group.heading}
							</CommandPrimitive.GroupHeading>
							<CommandPrimitive.GroupItems>
								{#each group.items as item (item.id)}
									{@render paletteItem(item)}
								{/each}
							</CommandPrimitive.GroupItems>
						</CommandPrimitive.Group>
					{/each}

					{#if mode === 'search' && loading && total === 0}
						<div class="cp-status flex items-center gap-2 px-3 py-2 text-sm text-muted">
							<span class="i-lucide-loader-circle h-4 w-4 animate-spin" aria-hidden="true"></span>
							Searching…
						</div>
					{/if}

					{#if mode === 'search' && hasQuery}
						<button class="cp-more" onclick={goToSearchPage}>
							<span class="i-lucide-search h-4 w-4 shrink-0" aria-hidden="true"></span>
							<span>Search everything for “{query.trim()}”</span>
							<span class={commandShortcutVariants()}>↵</span>
						</button>
					{/if}
				</CommandPrimitive.List>
			</CommandPrimitive.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

{#snippet paletteItem(item: CommandPaletteItem)}
	<div class="cp-item-row">
		<CommandPrimitive.Item
			value="{item.label} {item.hint ?? ''}"
			class={cn(
				commandItemVariants(),
				'flex-1 min-w-0',
				item.hint || item.snippet ? 'py-1.5' : 'py-2',
			)}
			onSelect={() => handleSelect(item)}
		>
			<span class={cn(item.icon, 'h-4 w-4 shrink-0')} ></span>
			<span class="flex flex-col min-w-0">
				<span class="flex items-center gap-2 min-w-0">
					<span class="truncate">{item.label}</span>
					{#if item.badge === 'en-fallback'}
						<span class="cp-badge" aria-label="English content">EN</span>
					{/if}
				</span>
				{#if item.hint}
					<span class="cp-hint truncate">{item.hint}</span>
				{/if}
				{#if item.snippet}
					<span class="cp-snippet">
						{#each segments(item.snippet, item.highlight) as seg}{#if seg.mark}<mark class="cp-mark">{seg.text}</mark>{:else}{seg.text}{/if}{/each}
					</span>
				{/if}
			</span>
			{#if item.shortcut}
				<span class={commandShortcutVariants()}>{item.shortcut}</span>
			{/if}
		</CommandPrimitive.Item>
		{#if item.secondary}
			<button
				class="cp-secondary-btn"
				tabindex={-1}
				title={item.secondary.label}
				onclick={(e: MouseEvent) => {
					e.stopPropagation();
					handleSecondary(item);
				}}
			>
				<span class={cn(item.secondary.icon, 'h-3.5 w-3.5')} ></span>
			</button>
		{/if}
	</div>
{/snippet}

<style>
	.cp-input-row {
		background-color: var(--color-input);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		border: 1px solid var(--color-input-border);
	}

	.cp-hint {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.2;
	}

	.cp-snippet {
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.cp-mark {
		background: transparent;
		color: var(--color-fg);
		font-weight: 600;
	}

	.cp-badge {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
		line-height: 1;
		padding: 2px 4px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background-color: color-mix(in srgb, var(--color-muted) 18%, transparent);
	}

	.cp-more {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		color: var(--color-muted);
		background: transparent;
		cursor: pointer;
		text-align: left;
	}

	.cp-more:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.cp-more span:nth-child(2) {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Row wrapper for item + secondary button */
	.cp-item-row {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: var(--radius-md);
	}

	/* Highlighted item via Bits UI Command data attribute */
	:global([data-command-item][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	/* Secondary action button */
	.cp-secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background: transparent;
		cursor: pointer;
		opacity: 0;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.cp-secondary-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.cp-secondary-btn:focus-visible {
		opacity: 1;
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.cp-item-row:hover .cp-secondary-btn,
	:global(.cp-item-row:has([data-highlighted])) .cp-secondary-btn,
	.cp-item-row:focus-within .cp-secondary-btn {
		opacity: 1;
	}
</style>
