<!--
  Card wrapper for cycle visualizations with a fullscreen-expand button.
  Renders the children snippet twice: once inline, once in a portaled dialog.
  Reactive state flows through both instances automatically.
-->
<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import type { Snippet } from 'svelte';
import { Card } from '$lib/components/composites';

interface Props {
	title: string;
	subtitle?: string;
	children: Snippet;
}

let { title, subtitle, children }: Props = $props();
let expanded = $state(false);
</script>

<Card>
	{#snippet header()}
		<div class="flex items-center justify-between gap-3">
			<div class="flex items-baseline gap-3 min-w-0">
				<h3 class="text-fluid-sm font-semibold truncate">{title}</h3>
				{#if subtitle}
					<span class="text-fluid-xs text-muted truncate">{subtitle}</span>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (expanded = true)}
				class="expand-btn"
				aria-label="Expand {title} to fullscreen"
				title="Expand"
			>
				<span class="i-lucide-maximize-2 h-4 w-4" aria-hidden="true"></span>
			</button>
		</div>
	{/snippet}
	{@render children()}
</Card>

<DialogPrimitive.Root bind:open={expanded}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-overlay bg-black/85 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<DialogPrimitive.Content class="viz-dialog-content">
			<header class="viz-dialog-header">
				<DialogPrimitive.Title class="text-fluid-md font-semibold">
					{title}
				</DialogPrimitive.Title>
				{#if subtitle}
					<span class="text-fluid-xs text-muted">{subtitle}</span>
				{/if}
				<div class="flex-1"></div>
				<DialogPrimitive.Close class="close-btn" aria-label="Close">
					<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
					<kbd class="esc-hint">Esc</kbd>
				</DialogPrimitive.Close>
			</header>
			<div class="viz-dialog-body">
				{@render children()}
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
	.expand-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.375rem;
		color: var(--color-muted);
		background: transparent;
		border: 1px solid transparent;
		cursor: pointer;
		transition: color 150ms, background 150ms, border-color 150ms;
		flex-shrink: 0;
	}

	.expand-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
		border-color: var(--color-border);
	}

	.expand-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	:global(.viz-dialog-content) {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: var(--z-modal, 50);
		width: 95vw;
		max-width: 1600px;
		height: 85vh;
		max-height: 900px;
		display: flex;
		flex-direction: column;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.viz-dialog-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-2);
		flex-shrink: 0;
	}

	.viz-dialog-body {
		flex: 1;
		overflow: auto;
		padding: 1.5rem 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.viz-dialog-body :global(> *) {
		width: 100%;
	}

	:global(.close-btn) {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.625rem;
		border-radius: 0.375rem;
		color: var(--color-muted);
		background: transparent;
		border: 1px solid var(--color-border);
		cursor: pointer;
		transition: color 150ms, background 150ms;
	}

	:global(.close-btn:hover) {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	:global(.close-btn:focus-visible) {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-primary);
	}

	.esc-hint {
		font-family: var(--font-mono, monospace);
		font-size: 0.6875rem;
		padding: 0.0625rem 0.3125rem;
		border-radius: 0.25rem;
		background: var(--color-surface-3);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
	}

	@media (max-width: 640px) {
		:global(.viz-dialog-content) {
			width: 100vw;
			height: 100vh;
			max-width: none;
			max-height: none;
			border-radius: 0;
		}
		.viz-dialog-body {
			padding: 1rem;
		}
	}
</style>
