<script lang="ts">
import { Dialog } from 'bits-ui';
import type { Snippet } from 'svelte';
import { Button } from '$lib/components/primitives';
import { ScrollArea } from '$lib/components/primitives/scroll-area';
import { Tabs } from '$lib/components/primitives/tabs';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';
import { renderMarkdown } from '$lib/utils/markdown';
import CodeBlock from './CodeBlock.svelte';
import PropsTable from './PropsTable.svelte';
import type { ComponentDoc, InfoSection } from './types';

interface Props {
	/** Dialog title */
	title: string;
	/** Optional subtitle */
	description?: string;
	/** Trigger icon class */
	icon?: string;
	/** Trigger aria-label */
	ariaLabel?: string;
	/** Structured documentation mode */
	doc?: ComponentDoc;
	/** Simple content mode */
	children?: Snippet;
	/** Custom tabbed mode */
	sections?: InfoSection[];
	/** Additional dialog classes */
	class?: string;
	/** Externally controlled open state */
	open?: boolean;
	/** Hide the built-in trigger button (use when controlled externally) */
	noTrigger?: boolean;
}

let {
	title,
	description,
	icon = 'i-lucide-info',
	ariaLabel,
	doc,
	children,
	sections,
	class: className,
	open = $bindable(false),
	noTrigger = false,
}: Props = $props();

const docTabs = $derived.by(() => {
	if (!doc) return [];
	const tabs: { id: string; label: string; icon: string }[] = [];
	if (doc.props?.length) tabs.push({ id: 'props', label: m.composites_info_dialog_props(), icon: 'i-lucide-list' });
	if (doc.source) tabs.push({ id: 'source', label: m.composites_info_dialog_source(), icon: 'i-lucide-code-2' });
	if (doc.usage) tabs.push({ id: 'usage', label: m.composites_info_dialog_usage(), icon: 'i-lucide-file-code' });
	if (doc.notes) tabs.push({ id: 'notes', label: m.composites_info_dialog_notes(), icon: 'i-lucide-book-open' });
	return tabs;
});

const hasDocContent = $derived(docTabs.length > 0);
const hasSections = $derived(sections && sections.length > 0);
const useDocMode = $derived(doc && hasDocContent);
const useSectionsMode = $derived(!useDocMode && hasSections);
</script>

{#snippet propsContent()}
	{#if doc?.props}
		<PropsTable props={doc.props} />
	{/if}
{/snippet}

{#snippet sourceContent()}
	{#if doc?.source}
		<CodeBlock
			highlightedHtml={doc.source.html}
			language={doc.source.language}
			filename={doc.source.filename}
		/>
	{/if}
{/snippet}

{#snippet usageContent()}
	{#if doc?.usage}
		<CodeBlock
			highlightedHtml={doc.usage.html}
			language={doc.usage.language}
			filename={doc.usage.filename}
		/>
	{/if}
{/snippet}

{#snippet notesContent()}
	{#if doc?.notes}
		<div class="info-notes">
			{@html renderMarkdown(doc.notes)}
		</div>
	{/if}
{/snippet}

{#if !noTrigger}
<Button
	variant="ghost"
	size="icon"
	class="info-trigger"
	title={ariaLabel ?? title}
	aria-label={ariaLabel ?? m.composites_info_dialog_aria({ title })}
	onclick={() => (open = true)}
>
	<span class="{icon} h-4 w-4" aria-hidden="true"></span>
</Button>
{/if}

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<Dialog.Content
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-full max-w-3xl rounded-lg border border-border bg-surface-3 shadow-xl',
				'flex flex-col',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				className
			)}
		>
			<!-- Header -->
			<div class="dialog-header">
				<div>
					<Dialog.Title class="text-fluid-lg font-semibold text-fg">
						{title}
					</Dialog.Title>
					{#if description}
						<Dialog.Description class="text-fluid-sm text-muted mt-1">
							{description}
						</Dialog.Description>
					{/if}
				</div>
				<Dialog.Close class="dialog-close">
					<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
					<span class="sr-only">{m.composites_dialog_close()}</span>
				</Dialog.Close>
			</div>

			<!-- Content -->
			<ScrollArea class="dialog-scroll">
				{#if useDocMode}
					{@const tabItems = docTabs.map((t) => {
						const snippetMap: Record<string, typeof propsContent> = {
							props: propsContent,
							source: sourceContent,
							usage: usageContent,
							notes: notesContent,
						};
						return { value: t.id, label: t.label, content: snippetMap[t.id] };
					})}
					{#if tabItems.length === 1}
						<div class="dialog-content">
							{@render tabItems[0].content()}
						</div>
					{:else}
						<div class="dialog-content">
							<Tabs tabs={tabItems} />
						</div>
					{/if}
				{:else if useSectionsMode && sections}
					{@const tabItems = sections.map((s) => ({
						value: s.id,
						label: s.label,
						content: s.content,
					}))}
					<div class="dialog-content">
						<Tabs tabs={tabItems} />
					</div>
				{:else if children}
					<div class="dialog-content">
						{@render children()}
					</div>
				{/if}
			</ScrollArea>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.info-trigger) {
		width: 1.75rem;
		height: 1.75rem;
		color: var(--color-muted);
		opacity: 0.7;
		flex-shrink: 0;
	}

	:global(.info-trigger:hover) {
		color: var(--color-fg);
		opacity: 1;
	}

	.dialog-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: var(--spacing-5) var(--spacing-6);
		border-bottom: 1px solid var(--color-border);
		gap: var(--spacing-4);
	}

	.dialog-close {
		flex-shrink: 0;
		padding: var(--spacing-1);
		border-radius: var(--radius-sm);
		opacity: 0.7;
		color: var(--color-muted);
		cursor: pointer;
	}

	.dialog-close:hover {
		opacity: 1;
		color: var(--color-fg);
	}

	.dialog-close:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	:global(.dialog-scroll) {
		max-height: 70vh;
	}

	.dialog-content {
		padding: var(--spacing-5) var(--spacing-6);
	}

	.info-notes {
		font-size: var(--text-fluid-sm);
		line-height: 1.7;
		color: var(--color-body);
	}

	.info-notes :global(p) {
		margin-bottom: var(--spacing-3);
	}

	.info-notes :global(p:last-child) {
		margin-bottom: 0;
	}

	.info-notes :global(code) {
		font-family: var(--font-mono, monospace);
		font-size: 0.9em;
		padding: 0.15em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.info-notes :global(strong) {
		font-weight: 600;
		color: var(--color-fg);
	}
</style>
