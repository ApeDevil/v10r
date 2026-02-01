<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'info' | 'success' | 'warning' | 'error';
		title?: string;
		description?: string;
		children?: Snippet;
		closable?: boolean;
		onclose?: () => void;
		class?: string;
	}

	let {
		variant = 'info',
		title,
		description,
		children,
		closable = false,
		onclose,
		class: className
	}: Props = $props();

	let visible = $state(true);

	const iconClasses = {
		info: 'i-lucide-info',
		success: 'i-lucide-check-circle',
		warning: 'i-lucide-alert-triangle',
		error: 'i-lucide-x-circle'
	};

	const styles = {
		info: 'border-primary/50 bg-primary/10 text-primary',
		success: 'border-success/50 bg-success/10 text-success',
		warning: 'border-warning/50 bg-warning/10 text-warning',
		error: 'border-error/50 bg-error/10 text-error'
	};

	function handleClose() {
		visible = false;
		onclose?.();
	}
</script>

{#if visible}
	<div
		class={cn(
			'relative flex gap-3 rounded-lg border p-4',
			styles[variant],
			className
		)}
		role="alert"
	>
		<span class={cn(iconClasses[variant], 'h-5 w-5 shrink-0')} />

		<div class="flex-1">
			{#if title}
				<h5 class="mb-1 font-semibold">{title}</h5>
			{/if}

			{#if description}
				<p class="text-fluid-sm opacity-90">{description}</p>
			{/if}

			{#if children}
				<div class="mt-2">
					{@render children()}
				</div>
			{/if}
		</div>

		{#if closable}
			<button
				onclick={handleClose}
				class="shrink-0 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
				aria-label="Close alert"
			>
				<span class="i-lucide-x h-4 w-4" />
			</button>
		{/if}
	</div>
{/if}
