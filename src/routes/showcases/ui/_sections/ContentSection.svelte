<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import { Card, LinkCard, Pagination, ConfirmDialog, Button, Carousel, CarouselItem, Chart } from '$lib/components';

	let currentPage = $state(1);
	const totalPages = 10;

	let confirmOpen = $state(false);
	let confirmResult = $state<boolean | null>(null);

	const chartData = [
		{ label: 'Jan', value: 40 },
		{ label: 'Feb', value: 65 },
		{ label: 'Mar', value: 45 },
		{ label: 'Apr', value: 80 },
		{ label: 'May', value: 55 },
		{ label: 'Jun', value: 70 }
	];
</script>

<section id="comp-content" class="section">
	<h2 class="section-title">Content</h2>
	<p class="section-description">Components for structuring and presenting content.</p>

	<div class="demos">
		<!-- Card -->
		<DemoCard title="Card" description="Container with header and footer">
			<div class="card-demo">
				<Card>
					{#snippet header()}
						<h3 class="card-header-title">Card Header</h3>
					{/snippet}

					{#snippet children()}
						<p>This is the card content area. It can contain any content.</p>
					{/snippet}

					{#snippet footer()}
						<span class="card-footer-text">Card Footer</span>
					{/snippet}
				</Card>
			</div>
		</DemoCard>

		<!-- LinkCard -->
		<DemoCard title="Link Card" description="Clickable card for navigation">
			<div class="link-card-grid">
				<LinkCard
					href="/showcases"
					title="With Icon"
					description="A link card with a leading icon."
					icon="i-lucide-rocket"
				/>
				<LinkCard
					href="/showcases"
					title="Plain Card"
					description="A simple link card without an icon."
				/>
			</div>
		</DemoCard>

		<!-- Carousel -->
		<DemoCard title="Carousel" description="Scrollable slide container">
			<div class="carousel-demo">
				<Carousel showDots showArrows>
					<CarouselItem>
						<div class="carousel-slide slide-1">Slide 1</div>
					</CarouselItem>
					<CarouselItem>
						<div class="carousel-slide slide-2">Slide 2</div>
					</CarouselItem>
					<CarouselItem>
						<div class="carousel-slide slide-3">Slide 3</div>
					</CarouselItem>
					<CarouselItem>
						<div class="carousel-slide slide-4">Slide 4</div>
					</CarouselItem>
				</Carousel>
			</div>
		</DemoCard>

		<!-- Chart -->
		<DemoCard title="Chart" description="Data visualization (bar, line, area)">
			<div class="chart-demo">
				<Chart
					type="bar"
					data={chartData}
					width={500}
					height={250}
				/>
			</div>
		</DemoCard>

		<!-- Pagination -->
		<DemoCard title="Pagination" description="Page navigation">
			<div class="pagination-demo">
				<Pagination
					{currentPage}
					{totalPages}
					onPageChange={(page) => (currentPage = page)}
				/>
				<p class="page-info">Current page: {currentPage} of {totalPages}</p>
			</div>
		</DemoCard>

		<!-- Confirm Dialog -->
		<DemoCard title="Confirm Dialog" description="Confirmation prompt">
			<Button onclick={() => (confirmOpen = true)} variant="destructive">Delete Item</Button>
			{#if confirmResult !== null}
				<p class="confirm-result">
					Result: {confirmResult ? 'Confirmed' : 'Cancelled'}
				</p>
			{/if}

			<ConfirmDialog
				bind:open={confirmOpen}
				title="Confirm Delete"
				description="Are you sure you want to delete this item? This action cannot be undone."
				confirmLabel="Delete"
				cancelLabel="Cancel"
				destructive
				onconfirm={() => {
					confirmResult = true;
					confirmOpen = false;
				}}
				oncancel={() => {
					confirmResult = false;
					confirmOpen = false;
				}}
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

	.card-demo {
		width: 100%;
	}

	.card-header-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.card-footer-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.link-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: var(--spacing-4);
		width: 100%;
	}

	.carousel-demo {
		width: 100%;
		max-width: 32rem;
	}

	.carousel-slide {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 12rem;
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: white;
	}

	.slide-1 { background: hsl(var(--color-primary)); }
	.slide-2 { background: hsl(var(--color-secondary)); }
	.slide-3 { background: hsl(var(--color-accent)); }
	.slide-4 { background: hsl(var(--color-success)); }

	.chart-demo {
		width: 100%;
		overflow-x: auto;
	}

	.pagination-demo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-4);
		width: 100%;
	}

	.page-info {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.confirm-result {
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	@media (max-width: 640px) {
		.link-card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
