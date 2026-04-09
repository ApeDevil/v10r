<script lang="ts">
import type { Snippet } from 'svelte';
import { cn } from '$lib/utils/cn';

interface FieldContext {
	fieldId: string;
	errorId: string;
	descId: string;
	describedBy: string | undefined;
}

interface Props {
	label: string;
	id?: string;
	error?: string;
	description?: string;
	required?: boolean;
	children: Snippet<[FieldContext]>;
	class?: string;
}

let { label, id, error, description, required = false, children, class: className }: Props = $props();

// Generate IDs for accessibility
// svelte-ignore state_referenced_locally
const fieldId = id ?? crypto.randomUUID();
const errorId = `${fieldId}-error`;
const descId = `${fieldId}-description`;
const describedBy = $derived(error ? errorId : description ? descId : undefined);
</script>

<div class={cn('space-y-2', className)}>
	<label for={fieldId} class="text-fluid-sm font-medium text-fg">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</label>

	{#if description}
		<p id={descId} class="text-fluid-xs text-muted">{description}</p>
	{/if}

	<div>
		{@render children({ fieldId, errorId, descId, describedBy })}
	</div>

	{#if error}
		<p id={errorId} class="text-fluid-xs text-error" role="alert">
			{error}
		</p>
	{/if}
</div>
