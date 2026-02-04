<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { trapFocus } from '$lib/utils/focus-trap';
	import { getModals } from '$lib/stores/modals.svelte';
	import { getShortcutsByCategory, formatShortcut } from '$lib/shortcuts';

	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();

	const modals = getModals();

	// Get shortcuts grouped by category
	const shortcutsByCategory = $derived(getShortcutsByCategory());

	let modalRef: HTMLElement;

	// Set up focus trap when modal opens
	$effect(() => {
		if (modals.isOpen('shortcuts') && modalRef) {
			const cleanup = trapFocus(modalRef);
			return cleanup;
		}
	});

	function handleClose() {
		modals.close();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && modals.isOpen('shortcuts')) {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if modals.isOpen('shortcuts')}
	<div class="backdrop" onclick={handleBackdropClick} role="presentation">
		<div
			bind:this={modalRef}
			class={cn('modal', className)}
			role="dialog"
			aria-labelledby="shortcuts-title"
			aria-modal="true"
		>
			<div class="flex items-center justify-between p-6 border-b border-border">
				<h2 id="shortcuts-title" class="m-0 text-xl font-semibold text-fg">Keyboard Shortcuts</h2>
				<button
					class="bg-transparent border-none text-2xl leading-none cursor-pointer text-muted p-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm transition-all duration-normal hover:bg-border hover:text-fg motion-reduce:transition-none"
					onclick={handleClose}
					aria-label="Close shortcuts dialog"
				>
					&times;
				</button>
			</div>

			<div class="p-6 overflow-y-auto flex flex-col gap-4">
				{#if shortcutsByCategory.global.length > 0}
					<section class="flex flex-col gap-3">
						<h3 class="text-sm font-semibold uppercase tracking-wider text-muted m-0">Global</h3>
						<dl class="grid gap-2 m-0">
							{#each shortcutsByCategory.global as shortcut}
								<div class="flex items-center justify-between gap-4 p-2 rounded-sm transition-bg duration-normal hover:bg-border motion-reduce:transition-none">
									<dt class="flex-1 m-0 font-normal text-fg">{shortcut.description}</dt>
									<dd class="m-0">
										<kbd class="inline-block px-2 py-1 font-mono text-sm bg-border border border-muted rounded-sm shadow-sm text-fg whitespace-nowrap">{formatShortcut(shortcut.keys)}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if shortcutsByCategory.navigation.length > 0}
					<section class="flex flex-col gap-3">
						<h3 class="text-sm font-semibold uppercase tracking-wider text-muted m-0">Navigation</h3>
						<dl class="grid gap-2 m-0">
							{#each shortcutsByCategory.navigation as shortcut}
								<div class="flex items-center justify-between gap-4 p-2 rounded-sm transition-bg duration-normal hover:bg-border motion-reduce:transition-none">
									<dt class="flex-1 m-0 font-normal text-fg">{shortcut.description}</dt>
									<dd class="m-0">
										<kbd class="inline-block px-2 py-1 font-mono text-sm bg-border border border-muted rounded-sm shadow-sm text-fg whitespace-nowrap">{formatShortcut(shortcut.keys)}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if shortcutsByCategory.actions.length > 0}
					<section class="flex flex-col gap-3">
						<h3 class="text-sm font-semibold uppercase tracking-wider text-muted m-0">Actions</h3>
						<dl class="grid gap-2 m-0">
							{#each shortcutsByCategory.actions as shortcut}
								<div class="flex items-center justify-between gap-4 p-2 rounded-sm transition-bg duration-normal hover:bg-border motion-reduce:transition-none">
									<dt class="flex-1 m-0 font-normal text-fg">{shortcut.description}</dt>
									<dd class="m-0">
										<kbd class="inline-block px-2 py-1 font-mono text-sm bg-border border border-muted rounded-sm shadow-sm text-fg whitespace-nowrap">{formatShortcut(shortcut.keys)}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-4);
		z-index: var(--z-modal);
		animation: fadeIn var(--duration-normal) ease-out;
	}

	.modal {
		background: var(--surface-3);
		border-radius: var(--radius-lg);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		max-width: 600px;
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp var(--duration-normal) ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 640px) {
		.modal {
			max-width: 100%;
			max-height: 90vh;
		}
	}
</style>
