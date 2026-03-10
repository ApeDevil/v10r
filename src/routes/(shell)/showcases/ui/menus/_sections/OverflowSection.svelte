<script lang="ts">
import { DropdownMenu } from '$lib/components';
import { DemoCard } from '../../components/_components';

function noop() {}
</script>

<section id="menu-overflow" class="section">
	<h2 class="section-title">Overflow Menu</h2>
	<p class="section-description">
		Secondary actions hidden behind a trigger icon. Use when: a row or card has more than 3 actions
		and inline buttons would clutter the view.
	</p>

	<div class="demos">
		<DemoCard
			title="Kebab Menu (Vertical)"
			description="Three-dot icon trigger for row-level actions. Use when: actions overflow the visible space in tables or cards."
		>
			<div class="overflow-demo-row">
				<span class="overflow-demo-label">Invoice #1042</span>
				<span class="overflow-demo-meta">$2,450.00</span>
				<DropdownMenu
					items={[
						{ label: 'View Details', icon: 'i-lucide-eye' },
						{ label: 'Edit', icon: 'i-lucide-pencil' },
						{ label: 'Duplicate', icon: 'i-lucide-copy' },
						{ separator: true },
						{ label: 'Archive', icon: 'i-lucide-archive' },
						{ separator: true },
						{ label: 'Delete', icon: 'i-lucide-trash-2' },
					]}
				>
					{#snippet trigger({ props })}
						<button
							{...props}
							class="kebab-trigger"
							aria-label="More actions for Invoice #1042"
						>
							<span class="i-lucide-ellipsis-vertical h-4 w-4" ></span>
						</button>
					{/snippet}
				</DropdownMenu>
			</div>
		</DemoCard>

		<DemoCard
			title="Split Button"
			description="Primary action with secondary dropdown. Use when: there is one primary action and several alternatives."
		>
			<div class="split-btn-group">
				<button class="split-primary" onclick={noop}>
					Save
				</button>
				<DropdownMenu
					items={[
						{ label: 'Save as Draft', icon: 'i-lucide-file-edit' },
						{ label: 'Save & Close', icon: 'i-lucide-check-circle' },
						{ label: 'Save as Template', icon: 'i-lucide-layout-template' },
					]}
					align="end"
				>
					{#snippet trigger({ props })}
						<button {...props} class="split-trigger">
							<span class="i-lucide-chevron-down h-4 w-4" ></span>
						</button>
					{/snippet}
				</DropdownMenu>
			</div>
		</DemoCard>

		<DemoCard
			title="Contextual Overflow"
			description="Overflow menu appearing on hover over a list item. Use when: actions should be discoverable but not clutter the default view."
		>
			<div class="hover-list">
				{#each ['Project Alpha', 'Project Beta', 'Project Gamma'] as project}
					<div class="hover-row">
						<span class="i-lucide-folder h-4 w-4 text-muted" ></span>
						<span class="hover-row-label">{project}</span>
						<div class="hover-row-actions">
							<DropdownMenu
								items={[
									{ label: 'Open', icon: 'i-lucide-external-link' },
									{ label: 'Rename', icon: 'i-lucide-pencil' },
									{ label: 'Share', icon: 'i-lucide-share-2' },
									{ separator: true },
									{ label: 'Delete', icon: 'i-lucide-trash-2' },
								]}
							>
								{#snippet trigger({ props })}
									<button
										{...props}
										class="kebab-trigger"
										aria-label="More actions for {project}"
									>
										<span class="i-lucide-ellipsis h-4 w-4" ></span>
									</button>
								{/snippet}
							</DropdownMenu>
						</div>
					</div>
				{/each}
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

	/* Kebab trigger */
	.kebab-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		color: var(--color-muted);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.kebab-trigger:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.kebab-trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Row demo */
	.overflow-demo-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		width: 100%;
		max-width: 28rem;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.overflow-demo-label {
		font-weight: 500;
		color: var(--color-fg);
	}

	.overflow-demo-meta {
		flex: 1;
		text-align: right;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	/* Split button */
	.split-btn-group {
		display: inline-flex;
		align-items: stretch;
	}

	.split-primary,
	.split-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		font-weight: 500;
		font-size: var(--text-fluid-sm);
		color: var(--color-on-primary);
		background: var(--color-primary);
	}

	.split-primary {
		padding: var(--spacing-2) var(--spacing-4);
		border-radius: var(--radius-md) 0 0 var(--radius-md);
	}

	.split-trigger {
		padding: var(--spacing-2) var(--spacing-2);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		border-left: 1px solid color-mix(in srgb, var(--color-primary-fg) 20%, transparent);
	}

	.split-primary:hover,
	.split-trigger:hover {
		background: color-mix(in srgb, var(--color-primary) 85%, black);
	}

	.split-primary:focus-visible,
	.split-trigger:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Hover list */
	.hover-list {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 28rem;
	}

	/* Hover row */
	.hover-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		width: 100%;
		max-width: 28rem;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
	}

	.hover-row:hover {
		background: color-mix(in srgb, var(--color-muted) 5%, transparent);
	}

	.hover-row-label {
		flex: 1;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.hover-row-actions {
		opacity: 0;
		transition: opacity var(--duration-fast);
	}

	.hover-row:hover .hover-row-actions,
	.hover-row:focus-within .hover-row-actions {
		opacity: 1;
	}
</style>
