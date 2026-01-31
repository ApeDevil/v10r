<script lang="ts">
	import { getModals } from '$lib/stores/modals.svelte';
	import { getShortcutsByCategory, formatShortcut } from '$lib/shortcuts';

	const modals = getModals();

	// Get shortcuts grouped by category
	const shortcutsByCategory = $derived(getShortcutsByCategory());

	function handleClose() {
		modals.close();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}
</script>

{#if modals.isOpen('shortcuts')}
	<div class="backdrop" onclick={handleBackdropClick} role="presentation">
		<div
			class="modal"
			role="dialog"
			aria-labelledby="shortcuts-title"
			aria-modal="true"
		>
			<div class="header">
				<h2 id="shortcuts-title">Keyboard Shortcuts</h2>
				<button
					class="close-button"
					onclick={handleClose}
					aria-label="Close shortcuts dialog"
				>
					&times;
				</button>
			</div>

			<div class="content">
				{#if shortcutsByCategory.global.length > 0}
					<section>
						<h3>Global</h3>
						<dl class="shortcuts-list">
							{#each shortcutsByCategory.global as shortcut}
								<div class="shortcut-item">
									<dt>{shortcut.description}</dt>
									<dd>
										<kbd>{formatShortcut(shortcut.keys)}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if shortcutsByCategory.navigation.length > 0}
					<section>
						<h3>Navigation</h3>
						<dl class="shortcuts-list">
							{#each shortcutsByCategory.navigation as shortcut}
								<div class="shortcut-item">
									<dt>{shortcut.description}</dt>
									<dd>
										<kbd>{formatShortcut(shortcut.keys)}</kbd>
									</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}

				{#if shortcutsByCategory.actions.length > 0}
					<section>
						<h3>Actions</h3>
						<dl class="shortcuts-list">
							{#each shortcutsByCategory.actions as shortcut}
								<div class="shortcut-item">
									<dt>{shortcut.description}</dt>
									<dd>
										<kbd>{formatShortcut(shortcut.keys)}</kbd>
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
		padding: 1rem;
		z-index: 1000;
		animation: fadeIn 0.2s ease-out;
	}

	.modal {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		max-width: 600px;
		width: 100%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.2s ease-out;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.content {
		padding: 1.5rem;
		overflow-y: auto;
	}

	section {
		margin-bottom: 2rem;
	}

	section:last-child {
		margin-bottom: 0;
	}

	section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		margin: 0 0 0.75rem 0;
	}

	.shortcuts-list {
		display: grid;
		gap: 0.5rem;
		margin: 0;
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.shortcut-item:hover {
		background: #f9fafb;
	}

	.shortcut-item dt {
		flex: 1;
		margin: 0;
		font-weight: 400;
		color: #111827;
	}

	.shortcut-item dd {
		margin: 0;
	}

	kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		color: #374151;
		white-space: nowrap;
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

		.header {
			padding: 1rem;
		}

		.content {
			padding: 1rem;
		}
	}
</style>
