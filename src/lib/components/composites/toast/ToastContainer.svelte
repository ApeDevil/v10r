<script lang="ts">
	/**
	 * Toast notification container with auto-dismiss and transitions.
	 * Position: Fixed top-right (desktop), top-center full-width (mobile)
	 */

	import { fly } from 'svelte/transition';
	import { cn } from '$lib/utils/cn';
	import { getToast } from '$lib/state/toast.svelte';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	const toast = getToast();

	// Limit visible toasts to 5
	const visibleToasts = $derived(toast.items.slice(0, 5));

	// Auto-dismiss durations by type (ms)
	const durations = {
		success: 5000,
		error: 8000,
		warning: 6000,
		info: 5000,
	};

	// Toast icon classes
	const iconClasses = {
		success: 'i-lucide-check',
		error: 'i-lucide-x',
		warning: 'i-lucide-alert-triangle',
		info: 'i-lucide-info',
	};
</script>

{#if visibleToasts.length > 0}
	<div class={cn('fixed z-toast flex flex-col gap-2 pointer-events-none top-4 left-4 right-4 md:top-4 md:right-4 md:left-auto md:max-w-[420px]', className)} role="region" aria-live="polite" aria-label="Notifications">
		{#each visibleToasts as t (t.id)}
			<div
				class={cn(
					'toast flex items-center gap-3 p-4 bg-surface-1 border border-border rounded-lg shadow-md pointer-events-auto min-h-[3.5rem]',
					t.type === 'success' && 'border-l-4 border-l-success',
					t.type === 'error' && 'border-l-4 border-l-error',
					t.type === 'warning' && 'border-l-4 border-l-warning',
					t.type === 'info' && 'border-l-4 border-l-primary'
				)}
				transition:fly={{ x: 300, duration: 250 }}
				role="status"
				aria-atomic="true"
			>
				<div class={cn(
					'flex items-center justify-center w-6 h-6 shrink-0 text-base font-bold rounded-full text-white',
					t.type === 'success' && 'bg-success',
					t.type === 'error' && 'bg-error',
					t.type === 'warning' && 'bg-warning',
					t.type === 'info' && 'bg-primary'
				)}>
					<span class={iconClasses[t.type]} />
				</div>
				<div class="flex-1 text-sm leading-[1.4] text-fg">{t.message}</div>
				<button
					class="flex items-center justify-center w-[2.75rem] h-[2.75rem] shrink-0 p-[0.625rem] border-none bg-transparent text-muted cursor-pointer rounded-sm transition-all duration-fast hover:bg-border hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 motion-reduce:transition-none"
					onclick={() => toast.remove(t.id)}
					aria-label="Dismiss notification"
				>
					<span class="i-lucide-x" />
				</button>
			</div>
		{/each}
	</div>
{/if}

