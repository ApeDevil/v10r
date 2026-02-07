<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';
	import {
		accordionItemVariants,
		accordionTriggerVariants,
		accordionContentVariants,
		accordionChevronVariants,
		type AccordionVariants
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
		collapsible = true
	}: Props = $props();

	// Default value depends on type — can't reference type in $bindable() default
	if (value === undefined) {
		value = type === 'single' ? '' : [];
	}

	// Type guard to check if content is a snippet
	function isSnippet(content: string | Snippet): content is Snippet {
		return typeof content === 'function';
	}
</script>

{#if type === 'single'}
	<AccordionPrimitive.Root
		bind:value
		{collapsible}
		class={cn('w-full', className)}
	>
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
						{item.title}
						<span class={cn(accordionChevronVariants({ size }))} />
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
	</AccordionPrimitive.Root>
{:else}
	<AccordionPrimitive.Root
		bind:value
		multiple
		class={cn('w-full', className)}
	>
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
						{item.title}
						<span class={cn(accordionChevronVariants({ size }))} />
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
	</AccordionPrimitive.Root>
{/if}

<style>
	/* Accordion animation styles */
	:global([data-accordion-content]) {
		overflow: hidden;
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
