<script lang="ts">
import { PageHeader } from '$lib/components';
import type { ComponentDoc } from '$lib/components/composites/info-dialog/types';
import { DemoCard } from '../_components';

// NavSection is "meta-chrome" — it builds the showcase itself. The sticky bar at the
// top of this very page is a live instance. We document it by contract + a static
// facsimile rather than re-mounting it, which would duplicate the scroll observers,
// the <nav> landmark, and the sticky positioning. See docs/blueprint/design/components.md.
const navSectionDoc: ComponentDoc = {
	name: 'NavSection',
	description: 'Sticky in-page section navigation with scroll-spy active tracking.',
	props: [
		{
			name: 'sections',
			type: 'Array<{ id: string; label: string }>',
			required: true,
			description: 'Ordered sections to track. Each id must match the DOM id of a section element on the page.',
		},
		{
			name: 'ariaLabel',
			type: 'string',
			default: "'Section navigation'",
			description: 'Accessible label for the <nav> landmark.',
		},
	],
	// Joined with <br><br> rather than newlines: renderMarkdown strips control chars
	// (including \n), so block-level markdown (lists, paragraphs) collapses — only inline
	// markdown and explicit <br> survive.
	notes: [
		'**Documented by use, not re-mounted.** Every showcase page renders a live NavSection as its top chrome — the bar pinned at the top of *this* page is one. Shown here as a static facsimile rather than a second live instance, which would duplicate the scroll observers, the `<nav>` landmark, and the sticky positioning.',
		'**Wiring.** Place it above your main content and give each tracked section a matching DOM `id`. An IntersectionObserver highlights the section in view; vertical wheel scrolls the chip row horizontally; fade edges appear when the row overflows.',
		'**When to use.** Long single pages with several titled sections. Reach for tabs or breadcrumbs instead for cross-page navigation, and skip it on short pages.',
		'**Accessibility.** A labelled `<nav>` landmark; chips are buttons carrying `aria-current` on the active one; an `aria-live` region announces horizontal scroll position; chip targets meet the 24px minimum and chip-click scrolling honors `prefers-reduced-motion`.',
	].join('<br><br>'),
};
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

		<!-- NavSection (scroll-spy) — static facsimile; the live one is this page's top bar -->
		<DemoCard
			title="Section Navigation"
			description="Sticky scroll-spy chip bar — like the one pinned at the top of this page"
			doc={navSectionDoc}
		>
			<div class="navsection-demo">
				<div
					class="navsection-facsimile"
					role="img"
					aria-label="Section navigation bar: a row of section chips with the current section highlighted, shown in the elevated 'stuck' state. Chips scroll horizontally with a fade edge when they overflow."
				>
					<span class="facsimile-chip active">Overview</span>
					<span class="facsimile-chip">Inputs</span>
					<span class="facsimile-chip">Actions</span>
					<span class="facsimile-chip">Data Display</span>
					<span class="facsimile-chip">Overlays</span>
				</div>
				<p class="navsection-hint">
					The bar pinned at the top of this page is a live <code>NavSection</code> — scroll
					down and watch the active chip follow you.
				</p>
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

	/* Static, inert facsimile of NavSection. Not a <nav>, no focusable controls, no live
	   region — it mirrors the look (active / inactive / overflow-fade / stuck) only. The
	   real, interactive instance is this page's own top bar. */
	.navsection-demo {
		width: 100%;
	}

	.navsection-facsimile {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		width: 100%;
		overflow: hidden;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		/* Elevated "stuck" treatment */
		border-bottom: 1px solid var(--color-border);
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.06);
		/* Right-edge fade evoking horizontal overflow */
		mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
		-webkit-mask-image: linear-gradient(to right, black calc(100% - 32px), transparent 100%);
	}

	.facsimile-chip {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		min-height: var(--spacing-6);
		padding: var(--spacing-1) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		border-radius: var(--radius-md);
		white-space: nowrap;
		user-select: none;
	}

	.facsimile-chip.active {
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.navsection-hint {
		margin: var(--spacing-3) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.navsection-hint code {
		font-family: 'Fira Code', 'Courier New', monospace;
		font-size: 0.9em;
		color: var(--color-fg);
	}
</style>
