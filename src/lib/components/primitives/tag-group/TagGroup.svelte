<script lang="ts">
import { tick } from 'svelte';
import Tag from '../tag/Tag.svelte';
import type { TagVariants } from '../tag/tag';

interface TagItem {
	value: string;
	label: string;
	icon?: string;
}

interface Props extends TagVariants {
	items: TagItem[];
	dismissible?: boolean;
	ondismiss?: (value: string) => void;
	disabled?: boolean;
	label: string;
	class?: string;
}

let {
	items,
	dismissible = false,
	ondismiss,
	disabled = false,
	label,
	variant = 'default',
	size = 'md',
	class: className,
}: Props = $props();

let listEl: HTMLUListElement | undefined = $state();

function getFocusableItems(): HTMLElement[] {
	if (!listEl) return [];
	return Array.from(listEl.querySelectorAll<HTMLElement>('li[data-tag-item]'));
}

function focusItem(index: number) {
	const items = getFocusableItems();
	if (items.length === 0) return;
	const clamped = Math.max(0, Math.min(index, items.length - 1));
	for (const item of items) {
		item.setAttribute('tabindex', '-1');
	}
	items[clamped].setAttribute('tabindex', '0');
	items[clamped].focus();
}

function handleKeydown(e: KeyboardEvent) {
	const focusable = getFocusableItems();
	if (focusable.length === 0) return;

	const current = document.activeElement?.closest<HTMLElement>('li[data-tag-item]');
	const currentIndex = current ? focusable.indexOf(current) : -1;

	switch (e.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			e.preventDefault();
			focusItem(currentIndex + 1 < focusable.length ? currentIndex + 1 : 0);
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			e.preventDefault();
			focusItem(currentIndex - 1 >= 0 ? currentIndex - 1 : focusable.length - 1);
			break;
		case 'Home':
			e.preventDefault();
			focusItem(0);
			break;
		case 'End':
			e.preventDefault();
			focusItem(focusable.length - 1);
			break;
	}
}

async function handleDismiss(value: string) {
	if (!ondismiss) return;

	const focusable = getFocusableItems();
	const current = document.activeElement?.closest<HTMLElement>('li[data-tag-item]');
	const currentIndex = current ? focusable.indexOf(current) : -1;

	ondismiss(value);

	await tick();

	const remaining = getFocusableItems();
	if (remaining.length > 0) {
		const nextIndex = Math.min(currentIndex, remaining.length - 1);
		focusItem(nextIndex);
	}
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul
	bind:this={listEl}
	role="list"
	aria-label={label}
	class={className}
	onkeydown={handleKeydown}
>
	{#each items as item, i (item.value)}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<li
			data-tag-item
			tabindex={i === 0 ? 0 : -1}
		>
			<Tag
				label={item.label}
				icon={item.icon}
				{variant}
				{size}
				{disabled}
				ondismiss={dismissible ? () => handleDismiss(item.value) : undefined}
			/>
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		outline: none;
	}

	li:focus-visible {
		border-radius: 9999px;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}
</style>
