<script lang="ts">
import { Button, Spinner } from '$lib/components';
import type { ComponentDoc } from '$lib/components/composites/info-dialog/types';
import { DemoCard, VariantGrid } from '../_components';

interface Props {
	docs?: Record<string, ComponentDoc>;
}

let { docs }: Props = $props();

let isSaving = $state(false);
let isDeleting = $state(false);

function simulateSave() {
	isSaving = true;
	setTimeout(() => {
		isSaving = false;
	}, 2000);
}

function simulateDelete() {
	isDeleting = true;
	setTimeout(() => {
		isDeleting = false;
	}, 2000);
}
</script>

<section id="prim-actions" class="section">
	<h2 class="section-title">Actions</h2>
	<p class="section-description">Interactive elements that trigger actions.</p>

	<div class="demos">
		<!-- Button Variants -->
		<DemoCard title="Button Variants" description="Six visual weights — from filled primary down to ghost. Choose based on the action's importance on the page." doc={docs?.button}>
			<VariantGrid layout="row">
				<Button variant="primary">Primary</Button>
				<Button variant="default">Default</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="destructive">Destructive</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Button Sizes -->
		<DemoCard title="Button Sizes" description="Three sizes for different contexts. Icon is a square variant for toolbar and icon-only actions.">
			<VariantGrid layout="row">
				<Button size="sm">Small</Button>
				<Button size="md">Medium</Button>
				<Button size="lg">Large</Button>
				<Button size="icon" aria-label="Settings">
					<span class="i-lucide-settings" aria-hidden="true"></span>
				</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Common Patterns -->
		<DemoCard title="Common Patterns" description="Pairing guide — which variants to reach for in typical dialog footers and action bars.">
			<div class="patterns">
				<div class="pattern-row">
					<span class="pattern-label">Confirm action</span>
					<div class="pattern-buttons">
						<Button variant="default">Save changes</Button>
						<Button variant="outline">Cancel</Button>
					</div>
				</div>
				<div class="pattern-divider"></div>
				<div class="pattern-row">
					<span class="pattern-label">Encourage action</span>
					<div class="pattern-buttons">
						<Button variant="primary">Get started</Button>
						<Button variant="ghost">Maybe later</Button>
					</div>
				</div>
				<div class="pattern-divider"></div>
				<div class="pattern-row">
					<span class="pattern-label">Destructive confirm</span>
					<div class="pattern-buttons">
						<Button variant="destructive">Delete account</Button>
						<Button variant="outline">Keep account</Button>
					</div>
				</div>
			</div>
		</DemoCard>

		<!-- Loading States -->
		<DemoCard title="Loading States" description="Click to trigger a 2-second loading simulation. Disable the button during async work — never let users double-submit." doc={docs?.spinner}>
			<VariantGrid layout="row">
				<Button variant="default" disabled={isSaving} onclick={simulateSave}>
					{#if isSaving}
						<Spinner size="sm" variant="primary" label="Saving" />
						Saving…
					{:else}
						Save changes
					{/if}
				</Button>
				<Button variant="destructive" disabled={isDeleting} onclick={simulateDelete}>
					{#if isDeleting}
						<Spinner size="sm" variant="primary" label="Deleting" />
						Deleting…
					{:else}
						Delete
					{/if}
				</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Disabled States -->
		<DemoCard title="Disabled States" description="All variants apply the same 50% opacity treatment — consistent regardless of which variant is used.">
			<VariantGrid layout="row">
				<Button variant="primary" disabled>Primary</Button>
				<Button variant="default" disabled>Default</Button>
				<Button variant="secondary" disabled>Secondary</Button>
				<Button variant="outline" disabled>Outline</Button>
				<Button variant="ghost" disabled>Ghost</Button>
				<Button variant="destructive" disabled>Destructive</Button>
			</VariantGrid>
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

	/* Common Patterns card internals */
	.patterns {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 0;
	}

	.pattern-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-6);
		padding-block: var(--spacing-4);
		flex-wrap: wrap;
	}

	.pattern-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		min-width: 10rem;
		flex-shrink: 0;
	}

	.pattern-buttons {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.pattern-divider {
		height: 1px;
		background: var(--color-border);
	}
</style>
