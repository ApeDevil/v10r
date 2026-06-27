<script lang="ts">
/**
 * Quick access triggers for command palette + Vely (AI assistant).
 * Persistent buttons that transition between rail (icon-only) and expanded (fake input) modes.
 * Icons stay mounted across expand/collapse to prevent DOM swap jank.
 */

import { Kbd } from '$lib/components/primitives';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import { getModals } from '$lib/state/modals.svelte';
import { getSidebar } from '$lib/state/sidebar.svelte';
import { cn } from '$lib/utils/cn';

interface Props {
	forceExpanded?: boolean; // Force expanded mode (for drawer)
	class?: string;
}

let { forceExpanded = false, class: className }: Props = $props();

const sidebar = getSidebar();
const modals = getModals();

const isExpanded = $derived(forceExpanded || sidebar.expanded);

const cmdKey = 'Ctrl+';

// Vely trigger doubles as the restore affordance for a minimized/active conversation.
const chatActive = $derived(chatbotSession.phase !== 'closed');
const velyLabel = $derived(
	chatActive
		? chatbotSession.answerReady
			? 'Resume Vely — new reply'
			: 'Resume Vely conversation'
		: isExpanded
			? 'Ask Vely'
			: 'Ask Vely (Ctrl+J)',
);
</script>

<div class={cn('flex flex-col gap-2 p-2', className)}>
	<button
		type="button"
		style:height="var(--sidebar-item-size)"
		class={cn(
			'flex items-center whitespace-nowrap text-muted cursor-pointer border overflow-hidden transition-colors duration-fast motion-reduce:transition-none',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'trigger-input gap-2 px-2 bg-bg border-border rounded-md text-sm text-left w-full hover:border-primary hover:bg-fg-alpha'
				: 'justify-center border-transparent bg-transparent rounded-full opacity-60 hover:opacity-100 hover:bg-fg-alpha hover:text-fg rail-item'
		)}
		onclick={() => modals.open('quickSearch')}
		aria-label={isExpanded ? 'Search' : 'Search (Ctrl+K)'}
		title={isExpanded ? undefined : 'Search (Ctrl+K)'}
	>
		<span class="i-lucide-search text-icon-md shrink-0" ></span>
		{#if isExpanded}
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">Search...</span>
			<span class="trigger-kbd opacity-0 motion-reduce:opacity-100">
				<Kbd keys="{cmdKey}K" size="sm" />
			</span>
		{/if}
	</button>

	<button
		type="button"
		style:height="var(--sidebar-item-size)"
		class={cn(
			'flex items-center whitespace-nowrap text-muted cursor-pointer border overflow-hidden transition-colors duration-fast motion-reduce:transition-none',
			'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
			isExpanded
				? 'trigger-input gap-2 px-2 bg-bg border-border rounded-md text-sm text-left w-full hover:border-primary hover:bg-fg-alpha'
				: 'justify-center border-transparent bg-transparent rounded-full opacity-60 hover:opacity-100 hover:bg-fg-alpha hover:text-fg rail-item'
		)}
		onclick={() => chatbotSession.open()}
		aria-label={velyLabel}
		title={isExpanded ? undefined : velyLabel}
	>
		<span class="relative flex shrink-0">
			<span class="i-lucide-bot text-icon-md" ></span>
			{#if chatActive}
				<span class={cn('vely-dot', chatbotSession.answerReady && 'vely-dot-ready')} aria-hidden="true">
					{#if chatbotSession.answerReady}<span class="vely-ping"></span>{/if}
				</span>
			{/if}
		</span>
		{#if isExpanded}
			<span class="trigger-placeholder flex-1 opacity-0 motion-reduce:opacity-100">{chatActive ? 'Resume Vely' : 'Ask Vely...'}</span>
			<span class="trigger-kbd opacity-0 motion-reduce:opacity-100">
				{#if chatActive}
					<span class="i-lucide-chevron-up text-icon-sm" ></span>
				{:else}
					<Kbd keys="{cmdKey}J" size="sm" />
				{/if}
			</span>
		{/if}
	</button>
</div>

<style>
	/* Custom fadeIn animation */
	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	.trigger-placeholder,
	.trigger-kbd {
		animation: fadeIn var(--duration-fast) forwards;
	}

	@media (prefers-reduced-motion: reduce) {
		.trigger-placeholder,
		.trigger-kbd {
			animation: none;
			opacity: 1;
		}
	}

	/* Active-conversation indicator on the Vely trigger. Non-color encoding: an active
	 * thread is an 8px dot; an unseen reply is a larger 10px dot with a ping halo —
	 * size + motion, not hue alone. (arty owns final visual polish.) */
	.vely-dot {
		position: absolute;
		top: -3px;
		right: -3px;
		width: 8px;
		height: 8px;
		border-radius: 9999px;
		background-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--color-bg);
	}

	.vely-dot-ready {
		width: 10px;
		height: 10px;
	}

	.vely-ping {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		background-color: var(--color-primary);
		animation: vely-ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
	}

	@keyframes vely-ping {
		75%,
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.vely-ping {
			animation: none;
		}
	}
</style>
