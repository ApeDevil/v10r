<script lang="ts">
import { tick } from 'svelte';
import { Tag } from '$lib/components/primitives';
import type { TagVariants } from '$lib/components/primitives/tag/tag';
import { cn } from '$lib/utils/cn';

interface Props {
	value?: string[];
	placeholder?: string;
	delimiters?: string[];
	max?: number;
	maxLength?: number;
	allowDuplicates?: boolean;
	validate?: (tag: string) => string | undefined;
	size?: 'sm' | 'md';
	tagVariant?: TagVariants['variant'];
	disabled?: boolean;
	error?: boolean;
	id?: string;
	'aria-describedby'?: string;
	class?: string;
}

let {
	value = $bindable<string[]>([]),
	placeholder = 'Add tags...',
	delimiters = ['Enter'],
	max,
	maxLength,
	allowDuplicates = false,
	validate,
	size = 'md',
	tagVariant = 'default',
	disabled = false,
	error = false,
	id,
	'aria-describedby': ariaDescribedBy,
	class: className,
}: Props = $props();

let inputValue = $state('');
let pendingDeleteIndex = $state<number | null>(null);
let inputEl: HTMLInputElement | undefined = $state();
let announcement = $state('');
let shakeIndex = $state<number | null>(null);

const tagSize: TagVariants['size'] = 'sm';
let atMax = $derived(max != null && value.length >= max);
let countText = $derived(max != null ? `${value.length}/${max}` : '');

function trimAndValidate(raw: string): string | undefined {
	let tag = raw.trim();
	if (!tag) return undefined;
	if (maxLength) tag = tag.slice(0, maxLength);
	if (!allowDuplicates && value.includes(tag)) {
		const dupeIdx = value.indexOf(tag);
		triggerShake(dupeIdx);
		announce(`${tag} already added.`);
		return undefined;
	}
	if (validate) {
		const err = validate(tag);
		if (err) {
			announce(err);
			return undefined;
		}
	}
	if (atMax) {
		announce(`Maximum ${max} tags reached.`);
		return undefined;
	}
	return tag;
}

function addTag(raw: string) {
	const tag = trimAndValidate(raw);
	if (!tag) return false;
	value = [...value, tag];
	announce(`${tag} added. ${value.length} tag${value.length !== 1 ? 's' : ''} total.`);
	return true;
}

function removeTag(index: number) {
	const removed = value[index];
	value = value.filter((_, i) => i !== index);
	pendingDeleteIndex = null;
	announce(`${removed} removed. ${value.length} tag${value.length !== 1 ? 's' : ''} total.`);
}

function triggerShake(index: number) {
	shakeIndex = index;
	setTimeout(() => {
		shakeIndex = null;
	}, 300);
}

function announce(msg: string) {
	announcement = '';
	tick().then(() => {
		announcement = msg;
	});
}

function handleKeydown(e: KeyboardEvent) {
	if (disabled) return;

	if (delimiters.includes(e.key) && inputValue.trim()) {
		e.preventDefault();
		if (addTag(inputValue)) {
			inputValue = '';
		}
		return;
	}

	if (e.key === 'Backspace' && !inputValue && value.length > 0) {
		e.preventDefault();
		if (pendingDeleteIndex != null) {
			removeTag(pendingDeleteIndex);
		} else {
			pendingDeleteIndex = value.length - 1;
		}
		return;
	}

	// Any other key resets pending delete
	if (pendingDeleteIndex != null && e.key !== 'Backspace') {
		pendingDeleteIndex = null;
	}
}

function handlePaste(e: ClipboardEvent) {
	if (disabled) return;
	const text = e.clipboardData?.getData('text');
	if (!text) return;

	const parts = text
		.split(/[,\n]+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length <= 1) return; // let single values go through normal input

	e.preventDefault();
	let added = 0;
	for (const part of parts) {
		if (addTag(part)) added++;
	}
	inputValue = '';
}

function handleContainerClick() {
	if (!disabled) inputEl?.focus();
}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class={cn('tag-input-container', error && 'tag-input-error', disabled && 'tag-input-disabled', className)}
	class:size-sm={size === 'sm'}
	onclick={handleContainerClick}
	role="group"
	aria-labelledby={id ? `${id}-label` : undefined}
	aria-describedby={ariaDescribedBy}
	aria-invalid={error ? 'true' : undefined}
>
	{#if value.length > 0}
		<ul class="tag-list" role="list" aria-label="Selected tags">
			{#each value as tag, i (tag + i)}
				<li class:pending-delete={pendingDeleteIndex === i} class:shake={shakeIndex === i}>
					<Tag
						label={tag}
						variant={tagVariant}
						size={tagSize}
						{disabled}
						ondismiss={disabled ? undefined : () => removeTag(i)}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	<input
		bind:this={inputEl}
		bind:value={inputValue}
		type="text"
		{id}
		class="tag-input-field"
		class:size-sm={size === 'sm'}
		placeholder={value.length === 0 ? placeholder : ''}
		{disabled}
		readonly={atMax}
		autocomplete="off"
		aria-label={value.length === 0 ? placeholder : 'Add tag'}
		onkeydown={handleKeydown}
		onpaste={handlePaste}
	/>

	{#if countText}
		<span class="tag-count" class:at-max={atMax}>{countText}</span>
	{/if}

	<div class="sr-only" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.tag-input-container {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-1);
		min-height: 2.75rem;
		padding: var(--spacing-2) var(--spacing-3);
		background-color: var(--color-input-bg);
		border: none;
		border-bottom: 1px solid var(--color-input-border);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		cursor: text;
		transition: border-bottom-color 150ms ease, border-bottom-width 150ms ease;
	}

	.tag-input-container.size-sm {
		min-height: 2.25rem;
		padding: var(--spacing-1) var(--spacing-2);
	}

	.tag-input-container:focus-within {
		border-bottom: 2px solid var(--color-primary);
	}

	.tag-input-container.tag-input-error {
		border-bottom-color: var(--color-error);
	}

	.tag-input-container.tag-input-error:focus-within {
		border-bottom: 2px solid var(--color-error);
	}

	.tag-input-container.tag-input-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	.tag-list {
		display: contents;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.tag-list li {
		display: inline-flex;
	}

	.tag-list li.pending-delete {
		outline: 2px solid var(--color-error);
		outline-offset: 1px;
		border-radius: 9999px;
	}

	.tag-list li.shake {
		animation: tag-shake 200ms ease-in-out;
	}

	@keyframes tag-shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-3px); }
		75% { transform: translateX(3px); }
	}

	.tag-input-field {
		flex: 1 1 auto;
		min-width: 120px;
		border: none;
		outline: none;
		background: transparent;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		padding: var(--spacing-1) 0;
	}

	.tag-input-field.size-sm {
		font-size: var(--text-fluid-xs);
		min-width: 80px;
		padding: 0;
	}

	.tag-input-field::placeholder {
		color: var(--color-muted);
	}

	.tag-input-field:read-only {
		cursor: default;
	}

	.tag-count {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		flex-shrink: 0;
		user-select: none;
	}

	.tag-count.at-max {
		color: var(--color-warning);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
