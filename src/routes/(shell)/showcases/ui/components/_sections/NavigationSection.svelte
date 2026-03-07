<script lang="ts">
	import { DemoCard } from '../_components';
	import { PageHeader } from '$lib/components';
</script>

<section id="comp-navigation" class="section">
	<h2 class="section-title">Navigation</h2>
	<p class="section-description">Components for navigating between pages and sections.</p>

	<div class="demos">
		<!-- PageHeader -->
		<DemoCard title="Page Header" description="Page title and breadcrumbs">
			<div class="page-header-demo">
				<PageHeader
					title="Page Title"
					description="This is a page description that explains what this page is about."
					breadcrumbs={[
						{ label: 'Home', href: '/' },
						{ label: 'Showcases', href: '/showcases' },
						{ label: 'UI' }
					]}
				/>
			</div>
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

	.page-header-demo {
		width: 100%;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

</style>
