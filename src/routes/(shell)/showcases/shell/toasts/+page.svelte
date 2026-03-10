<script lang="ts">
import { Button } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

const toast = getToast();
</script>

<svelte:head>
	<title>Toasts - Shell - Showcases - Velociraptor</title>
</svelte:head>

<section class="demo-section">
	<h2>Toast Notifications</h2>
	<p>
		Toast notifications appear in the top-right (desktop) or top-center (mobile). They auto-dismiss
		after a duration based on type.
	</p>

	<div class="button-group">
		<Button variant="secondary" onclick={() => toast.success('Operation completed successfully!')}>
			Success
		</Button>
		<Button variant="secondary" onclick={() => toast.error('Something went wrong. Please try again.')}>
			Error
		</Button>
		<Button variant="secondary" onclick={() => toast.warning('This action cannot be undone.')}>
			Warning
		</Button>
		<Button variant="secondary" onclick={() => toast.info('New updates are available.')}>
			Info
		</Button>
	</div>

	<div class="button-group" style="margin-top: var(--spacing-3);">
		<Button
			variant="secondary"
			onclick={() => {
				toast.success('First toast');
				setTimeout(() => toast.info('Second toast'), 300);
				setTimeout(() => toast.warning('Third toast'), 600);
				setTimeout(() => toast.error('Fourth toast'), 900);
				setTimeout(() => toast.success('Fifth toast'), 1200);
			}}
		>
			Show Multiple Toasts (max 5)
		</Button>
	</div>

	{#if toast.items.length > 0}
		<div class="toast-preview">
			<h3>Active Toasts:</h3>
			<ul class="toast-list">
				{#each toast.items as t}
					<li class="toast-item toast-{t.type}">
						{t.message}
						<Button
							variant="ghost"
							size="icon"
							class="bg-transparent border-none text-white text-xl p-0 w-6 h-6 hover:bg-white/20"
							onclick={() => toast.remove(t.id)}
						>
							×
						</Button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>

<style>
	.demo-section {
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	h3 {
		font-size: var(--text-fluid-lg);
		margin-top: var(--spacing-4);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.toast-preview {
		margin-top: var(--spacing-4);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.toast-list {
		list-style: none;
		margin: var(--spacing-2) 0 0 0;
		padding: 0;
	}

	.toast-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		margin-bottom: var(--spacing-2);
		border-radius: var(--radius-md);
		color: var(--color-bg);
	}

	.toast-success { background: var(--color-success); }
	.toast-error { background: var(--color-error); }
	.toast-warning { background: var(--color-warning); }
	.toast-info { background: var(--color-primary); }
</style>
