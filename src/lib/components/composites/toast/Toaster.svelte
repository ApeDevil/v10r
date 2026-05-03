<script lang="ts">
import { fly } from 'svelte/transition';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';
import { cn } from '$lib/utils/cn';

const toast = getToast();

const iconClasses = {
	success: 'i-lucide-check-circle',
	error: 'i-lucide-x-circle',
	warning: 'i-lucide-alert-triangle',
	info: 'i-lucide-info',
};

const styles = {
	success: 'toast-success bg-success-light text-success',
	error: 'toast-error bg-error-light text-error',
	warning: 'toast-warning bg-warning-light text-warning',
	info: 'toast-info bg-primary-dim text-primary',
};
</script>

<div class="fixed bottom-4 right-4 z-toast flex flex-col gap-2">
	{#each toast.items as item (item.id)}
		<div
			class={cn(
				'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-[300px]',
				styles[item.type]
			)}
			transition:fly={{ x: 100, duration: 200 }}
			role="alert"
			aria-live="polite"
		>
			<span class={cn(iconClasses[item.type], 'h-5 w-5 shrink-0')} ></span>
			<span class="flex-1 text-fluid-sm">{item.message}</span>
			<button
				onclick={() => toast.remove(item.id)}
				class="shrink-0 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
				aria-label={m.composites_toast_close()}
			>
				<span class="i-lucide-x h-4 w-4" ></span>
			</button>
		</div>
	{/each}
</div>

<style>
	/* UnoCSS can't apply opacity modifiers to CSS custom property colors */
	:global(.toast-success) {
		border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
	}
	:global(.toast-error) {
		border-color: color-mix(in srgb, var(--color-error) 50%, transparent);
	}
	:global(.toast-warning) {
		border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
	}
	:global(.toast-info) {
		border-color: color-mix(in srgb, var(--color-primary) 50%, transparent);
	}
</style>
