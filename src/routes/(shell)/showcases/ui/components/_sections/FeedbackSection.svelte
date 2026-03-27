<script lang="ts">
import { Alert, EmptyState } from '$lib/components';
import { Button } from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';
import { DemoCard, VariantGrid } from '../_components';

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
				<Button variant="outline" onclick={() => showToast('success')}>Success Toast</Button>
				<Button variant="outline" onclick={() => showToast('error')}>Error Toast</Button>
				<Button variant="outline" onclick={() => showToast('warning')}>Warning Toast</Button>
				<Button variant="outline" onclick={() => showToast('info')}>Info Toast</Button>
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

</style>
