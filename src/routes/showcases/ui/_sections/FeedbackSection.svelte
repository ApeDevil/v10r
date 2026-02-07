<script lang="ts">
	import { DemoCard, VariantGrid } from '../_components';
	import { Alert, EmptyState } from '$lib/components';
	import { getToast } from '$lib/stores/toast.svelte';

	const toast = getToast();

	function showToast(type: 'success' | 'error' | 'warning' | 'info') {
		toast[type](`This is a ${type} toast message!`);
	}
</script>

<section id="comp-feedback" class="section">
	<h2 class="section-title">Feedback</h2>
	<p class="section-description">Components that communicate status and information.</p>

	<div class="demos">
		<!-- Alert Variants -->
		<DemoCard title="Alert Variants" description="Different alert types">
			<div class="alert-grid">
				<Alert variant="info" title="Information" description="This is an informational message." />
				<Alert variant="success" title="Success" description="Operation completed successfully." />
				<Alert variant="warning" title="Warning" description="Please review this warning." />
				<Alert variant="error" title="Error" description="An error occurred." />
			</div>
		</DemoCard>

		<!-- Closable Alert -->
		<DemoCard title="Closable Alert" description="Alert with close button">
			<Alert
				variant="info"
				title="Dismissible"
				description="You can close this alert."
				closable
			/>
		</DemoCard>

		<!-- Toast -->
		<DemoCard title="Toast" description="Temporary notifications">
			<VariantGrid layout="row">
				<button class="toast-btn" onclick={() => showToast('success')}>Success Toast</button>
				<button class="toast-btn" onclick={() => showToast('error')}>Error Toast</button>
				<button class="toast-btn" onclick={() => showToast('warning')}>Warning Toast</button>
				<button class="toast-btn" onclick={() => showToast('info')}>Info Toast</button>
			</VariantGrid>
		</DemoCard>

		<!-- Empty State -->
		<DemoCard title="Empty State" description="No content indicator">
			<EmptyState
				icon="lucide:inbox"
				title="No items"
				description="There are no items to display."
			/>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.alert-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.toast-btn {
		padding: var(--spacing-2) var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: all var(--duration-fast);
	}

	.toast-btn:hover {
		background: var(--color-subtle);
	}

	.toast-btn:active {
		transform: scale(0.98);
	}
</style>
