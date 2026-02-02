<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import VariantGrid from './shared/VariantGrid.svelte';
	import { Alert, Badge, Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, EmptyState } from '$lib/components';
	import { getToast } from '$lib/stores/toast.svelte';

	const toast = getToast();

	function showToast(type: 'success' | 'error' | 'warning' | 'info') {
		toast[type](`This is a ${type} toast message!`);
	}
</script>

<section id="feedback" class="section">
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

		<!-- Badge Variants -->
		<DemoCard title="Badge Variants" description="Status indicators">
			<VariantGrid layout="row">
				<Badge variant="default">Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="success">Success</Badge>
				<Badge variant="warning">Warning</Badge>
				<Badge variant="error">Error</Badge>
				<Badge variant="outline">Outline</Badge>
			</VariantGrid>
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

		<!-- Skeleton -->
		<DemoCard title="Skeleton" description="Loading placeholders">
			<div class="skeleton-demo">
				<SkeletonCard />
				<div class="skeleton-text-demo">
					<SkeletonAvatar />
					<div class="skeleton-text-group">
						<SkeletonText width="60%" />
						<SkeletonText width="40%" />
					</div>
				</div>
			</div>
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
		scroll-margin-top: 80px;
		margin-bottom: 3rem;
	}

	.section-title {
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 2rem 0;
		font-size: 1rem;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.alert-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.toast-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toast-btn:hover {
		background: var(--color-subtle);
	}

	.toast-btn:active {
		transform: scale(0.98);
	}

	.skeleton-demo {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
		max-width: 400px;
	}

	.skeleton-text-demo {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.skeleton-text-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
