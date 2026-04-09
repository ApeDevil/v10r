<script lang="ts">
import { Accordion as AccordionPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';
import {
	type AccordionVariants,
	accordionChevronVariants,
	accordionContentVariants,
	accordionItemVariants,
	accordionTriggerVariants,
} from './accordion';

interface AccordionItem {
	value: string;
	title: string;
	content: string | Snippet;
	disabled?: boolean;
}

interface Props extends AccordionVariants {
	/** Accordion type: single allows one open at a time, multiple allows many */
	type?: 'single' | 'multiple';
	/** Current value(s) - single: string, multiple: string[] */
	value?: string | string[];
	/** Array of accordion items with value, title, and content */
	items: AccordionItem[];
	/** Additional class for root container */
	class?: string;
	/** Allow collapsing the currently open item (only for type="single") */
	collapsible?: boolean;
}

let {
	type = 'single',
	value = $bindable(),
	items,
	variant = 'default',
	size = 'md',
	class: className,
	collapsible = true,
}: Props = $props();

// Default value depends on type — can't reference type in $bindable() default
// svelte-ignore state_referenced_locally
if (value === undefined) {
	value = type === 'single' ? '' : [];
}

// Type guard to check if content is a snippet
function isSnippet(content: string | Snippet): content is Snippet {
	return typeof content === 'function';
}
</script>

{#snippet accordionItems()}
	{#each items as item (item.value)}
		<AccordionPrimitive.Item
			value={item.value}
			disabled={item.disabled}
			class={cn(accordionItemVariants({ variant }))}
		>
			<AccordionPrimitive.Header>
				<AccordionPrimitive.Trigger
					class={cn(
						accordionTriggerVariants({ size }),
						'text-fg hover:text-primary',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
						'disabled:cursor-not-allowed disabled:opacity-50',
						'[&[data-state=open]>span]:rotate-180'
					)}
				>
					<span class={cn(accordionChevronVariants({ size }))} ></span>
					{item.title}
				</AccordionPrimitive.Trigger>
			</AccordionPrimitive.Header>
			<AccordionPrimitive.Content
				class={cn(
					accordionContentVariants({ size }),
					'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down'
				)}
			>
				<div class="pt-1">
					{#if isSnippet(item.content)}
						{@render item.content()}
					{:else}
						{item.content}
					{/if}
				</div>
			</AccordionPrimitive.Content>
		</AccordionPrimitive.Item>
	{/each}
{/snippet}

{#if type === 'single'}
	<AccordionPrimitive.Root
		type="single"
		value={value as string}
		onValueChange={(v: string) => value = v}
		class={cn('w-full', className)}
	>
		{@render accordionItems()}
	</AccordionPrimitive.Root>
{:else}
	<AccordionPrimitive.Root
		type="multiple"
		value={value as string[]}
		onValueChange={(v: string[]) => value = v}
		class={cn('w-full', className)}
	>
		{@render accordionItems()}
	</AccordionPrimitive.Root>
{/if}

<style>
	/* Content differentiation: muted text + primary border accent when open */
	:global([data-accordion-content]) {
		overflow: hidden;
		color: var(--color-muted);
	}

	:global([data-accordion-content][data-state='open']) {
		border-left: 2px solid var(--color-primary);
		margin-left: 6px;
	}

	:global([data-accordion-trigger][data-state='open']) {
		color: var(--color-primary);
	}

	:global([data-accordion-trigger][data-state='open'] span) {
		color: var(--color-primary);
	}

	@keyframes accordion-down {
		from {
			height: 0;
		}
		to {
			height: var(--bits-accordion-content-height);
		}
	}

	@keyframes accordion-up {
		from {
			height: var(--bits-accordion-content-height);
		}
		to {
			height: 0;
		}
	}

	:global(.animate-accordion-down) {
		animation: accordion-down var(--duration-normal) var(--ease-out);
	}

	:global(.animate-accordion-up) {
		animation: accordion-up var(--duration-normal) var(--ease-out);
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.animate-accordion-down),
		:global(.animate-accordion-up) {
			animation-duration: 0.01s !important;
		}
	}
</style>
