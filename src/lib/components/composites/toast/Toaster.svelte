<script lang="ts">
	import { getToast } from '$lib/state/toast.svelte';
	import { cn } from '$lib/utils/cn';
	import { fly } from 'svelte/transition';

	const toast = getToast();

	const iconClasses = {
		success: 'i-lucide-check-circle',
		error: 'i-lucide-x-circle',
		warning: 'i-lucide-alert-triangle',
		info: 'i-lucide-info'
	};

	const styles = {
		success: 'border-success/50 bg-success-light text-success',
		error: 'border-error/50 bg-error-light text-error',
		warning: 'border-warning/50 bg-warning-light text-warning',
		info: 'border-primary/50 bg-primary-light text-primary'
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
			<span class={cn(iconClasses[item.type], 'h-5 w-5 shrink-0')} />
			<span class="flex-1 text-fluid-sm">{item.message}</span>
			<button
				onclick={() => toast.remove(item.id)}
				class="shrink-0 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
				aria-label="Close notification"
			>
				<span class="i-lucide-x h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
