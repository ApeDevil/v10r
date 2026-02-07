<script lang="ts">
	import { Carousel, CarouselItem } from '$lib/components/primitives/carousel';
	import { Card } from '$lib/components';

	const demoSlides = [
		{ id: 1, title: 'First Slide', color: 'bg-primary/20', description: 'Welcome to the carousel' },
		{
			id: 2,
			title: 'Second Slide',
			color: 'bg-success/20',
			description: 'Smooth scrolling with CSS'
		},
		{
			id: 3,
			title: 'Third Slide',
			color: 'bg-warning/20',
			description: 'Keyboard navigation supported'
		},
		{
			id: 4,
			title: 'Fourth Slide',
			color: 'bg-error/20',
			description: 'Autoplay with pause on hover'
		}
	];

	const images = [
		'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop',
		'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=400&fit=crop',
		'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&h=400&fit=crop',
		'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=400&fit=crop'
	];
</script>

<div class="max-w-layout-narrow mx-auto space-y-fluid-6 p-fluid-4">
	<header class="space-y-fluid-2">
		<h1 class="text-fluid-4xl font-bold">Carousel Component</h1>
		<p class="text-fluid-lg text-muted">
			Native CSS scroll-snap carousel with keyboard navigation, autoplay, and touch support.
		</p>
	</header>

	<!-- Basic Example -->
	<section class="space-y-fluid-3">
		<div>
			<h2 class="text-fluid-2xl font-bold mb-2">Basic Carousel</h2>
			<p class="text-fluid-base text-muted">
				Horizontal carousel with arrows and dot navigation.
			</p>
		</div>

		<Carousel>
			{#each demoSlides as slide}
				<CarouselItem>
					<div
						class="h-64 {slide.color} rounded-lg flex flex-col items-center justify-center gap-3 p-8"
					>
						<h3 class="text-fluid-2xl font-bold">{slide.title}</h3>
						<p class="text-fluid-base text-muted">{slide.description}</p>
					</div>
				</CarouselItem>
			{/each}
		</Carousel>
	</section>

	<!-- Autoplay Example -->
	<section class="space-y-fluid-3">
		<div>
			<h2 class="text-fluid-2xl font-bold mb-2">Autoplay Carousel</h2>
			<p class="text-fluid-base text-muted">
				Automatically advances every 3 seconds. Pauses on hover.
			</p>
		</div>

		<Carousel autoplay={true} autoplayInterval={3000}>
			{#each images as src, i}
				<CarouselItem>
					<img
						{src}
						alt="Slide {i + 1}"
						class="w-full h-64 object-cover rounded-lg"
						loading="lazy"
					/>
				</CarouselItem>
			{/each}
		</Carousel>
	</section>

	<!-- No Controls Example -->
	<section class="space-y-fluid-3">
		<div>
			<h2 class="text-fluid-2xl font-bold mb-2">Minimal Carousel</h2>
			<p class="text-fluid-base text-muted">
				No arrows or dots. Swipe or use keyboard to navigate.
			</p>
		</div>

		<Carousel showArrows={false} showDots={false}>
			{#each demoSlides.slice(0, 3) as slide}
				<CarouselItem>
					<Card>
						<div class="p-8 space-y-2">
							<h3 class="text-fluid-xl font-bold">{slide.title}</h3>
							<p class="text-fluid-base text-muted">{slide.description}</p>
						</div>
					</Card>
				</CarouselItem>
			{/each}
		</Carousel>
	</section>

	<!-- Card Grid Carousel -->
	<section class="space-y-fluid-3">
		<div>
			<h2 class="text-fluid-2xl font-bold mb-2">Card Carousel</h2>
			<p class="text-fluid-base text-muted">
				Multiple cards per view with snap scrolling.
			</p>
		</div>

		<Carousel loop={false}>
			{#each Array.from({ length: 6 }, (_, i) => i + 1) as num}
				<CarouselItem>
					<div class="px-2">
						<Card>
							<div class="p-6 space-y-3">
								<div class="h-32 bg-primary/10 rounded-lg flex items-center justify-center">
									<span class="text-fluid-3xl font-bold text-primary">{num}</span>
								</div>
								<h4 class="text-fluid-lg font-semibold">Card {num}</h4>
								<p class="text-fluid-sm text-muted">
									Example card content for demonstration.
								</p>
							</div>
						</Card>
					</div>
				</CarouselItem>
			{/each}
		</Carousel>
	</section>

	<!-- Features -->
	<section class="space-y-fluid-3">
		<h2 class="text-fluid-2xl font-bold">Features</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-fluid-4">
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Native CSS Scroll-Snap</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Uses CSS <code class="bg-muted/10 px-1 rounded">scroll-snap-type</code> for smooth,
					performant scrolling without JavaScript overhead.
				</p>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Touch Support</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Swipe gestures work natively on touch devices through native scroll behavior.
				</p>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Keyboard Navigation</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Navigate with arrow keys. Horizontal: Left/Right. Vertical: Up/Down.
				</p>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Autoplay</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Optional autoplay with configurable interval. Automatically pauses on hover.
				</p>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">IntersectionObserver</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Tracks active slide accurately using IntersectionObserver API for dot indicators.
				</p>
			</Card>

			<Card>
				{#snippet header()}
					<h3 class="text-fluid-lg font-semibold">Loop Mode</h3>
				{/snippet}
				<p class="text-fluid-sm text-muted">
					Optional looping. When enabled, next/prev buttons wrap around to first/last slide.
				</p>
			</Card>
		</div>
	</section>

	<!-- API -->
	<section class="space-y-fluid-3">
		<h2 class="text-fluid-2xl font-bold">Component API</h2>

		<Card>
			<div class="overflow-x-auto">
				<table class="w-full text-left text-fluid-sm">
					<thead class="border-b border-border">
						<tr>
							<th class="py-2 px-3 font-semibold">Prop</th>
							<th class="py-2 px-3 font-semibold">Type</th>
							<th class="py-2 px-3 font-semibold">Default</th>
							<th class="py-2 px-3 font-semibold">Description</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						<tr>
							<td class="py-2 px-3"><code>orientation</code></td>
							<td class="py-2 px-3">'horizontal' | 'vertical'</td>
							<td class="py-2 px-3">'horizontal'</td>
							<td class="py-2 px-3">Scroll direction</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>loop</code></td>
							<td class="py-2 px-3">boolean</td>
							<td class="py-2 px-3">true</td>
							<td class="py-2 px-3">Enable looping navigation</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>autoplay</code></td>
							<td class="py-2 px-3">boolean</td>
							<td class="py-2 px-3">false</td>
							<td class="py-2 px-3">Enable autoplay</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>autoplayInterval</code></td>
							<td class="py-2 px-3">number</td>
							<td class="py-2 px-3">3000</td>
							<td class="py-2 px-3">Autoplay interval in ms</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>showDots</code></td>
							<td class="py-2 px-3">boolean</td>
							<td class="py-2 px-3">true</td>
							<td class="py-2 px-3">Show dot indicators</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>showArrows</code></td>
							<td class="py-2 px-3">boolean</td>
							<td class="py-2 px-3">true</td>
							<td class="py-2 px-3">Show prev/next buttons</td>
						</tr>
						<tr>
							<td class="py-2 px-3"><code>class</code></td>
							<td class="py-2 px-3">string</td>
							<td class="py-2 px-3">undefined</td>
							<td class="py-2 px-3">Additional CSS classes</td>
						</tr>
					</tbody>
				</table>
			</div>
		</Card>
	</section>

	<!-- Usage Example -->
	<section class="space-y-fluid-3">
		<h2 class="text-fluid-2xl font-bold">Usage</h2>

		<Card>
			<div class="space-y-fluid-3">
				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Import</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code
							>import &#123; Carousel, CarouselItem &#125; from '$lib/components/primitives/carousel';</code
						></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Basic Example</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code
							>&lt;Carousel&gt;
  &#123;#each slides as slide&#125;
    &lt;CarouselItem&gt;
      &lt;div&gt;&#123;slide.content&#125;&lt;/div&gt;
    &lt;/CarouselItem&gt;
  &#123;/each&#125;
&lt;/Carousel&gt;</code
						></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">With Autoplay</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code
							>&lt;Carousel autoplay=&#123;true&#125; autoplayInterval=&#123;5000&#125;&gt;
  &lt;!-- slides --&gt;
&lt;/Carousel&gt;</code
						></pre>
				</div>

				<div>
					<h4 class="text-fluid-base font-semibold mb-2">Minimal (No Controls)</h4>
					<pre class="bg-muted/5 p-3 rounded text-fluid-sm overflow-x-auto"><code
							>&lt;Carousel showArrows=&#123;false&#125; showDots=&#123;false&#125;&gt;
  &lt;!-- slides --&gt;
&lt;/Carousel&gt;</code
						></pre>
				</div>
			</div>
		</Card>
	</section>

	<!-- Accessibility -->
	<section class="space-y-fluid-3">
		<h2 class="text-fluid-2xl font-bold">Accessibility</h2>

		<Card>
			<ul class="space-y-2 text-fluid-sm text-muted">
				<li class="flex items-start gap-2">
					<span class="text-success mt-0.5">✓</span>
					<span>Semantic ARIA roles: region, list, listitem, tab, tablist</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-success mt-0.5">✓</span>
					<span>Keyboard navigation with arrow keys</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-success mt-0.5">✓</span>
					<span>aria-label and aria-selected attributes for screen readers</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-success mt-0.5">✓</span>
					<span>Focus-visible indicators on all interactive elements</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-success mt-0.5">✓</span>
					<span>Disabled state for navigation buttons at boundaries (when loop=false)</span>
				</li>
			</ul>
		</Card>
	</section>
</div>
