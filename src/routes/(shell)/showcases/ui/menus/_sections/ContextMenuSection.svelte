<script lang="ts">
	import { DemoCard } from '../../components/_components';
	import { ContextMenu } from '$lib/components/composites';
</script>

<section id="menu-context" class="section">
	<h2 class="section-title">Context Menu</h2>
	<p class="section-description">
		Right-click or long-press triggered menus for spatial context actions. Use when: power users
		expect right-click shortcuts on content areas.
	</p>

	<div class="demos">
		<DemoCard
			title="Rich Context Menu"
			description="Icons, keyboard shortcuts, disabled items, and separators. Right-click the area below."
		>
			<ContextMenu
				items={[
					{ label: 'Cut', icon: 'i-lucide-scissors', shortcut: 'Ctrl+X' },
					{ label: 'Copy', icon: 'i-lucide-copy', shortcut: 'Ctrl+C' },
					{ label: 'Paste', icon: 'i-lucide-clipboard', shortcut: 'Ctrl+V' },
					{ separator: true },
					{ label: 'Select All', icon: 'i-lucide-check-square', shortcut: 'Ctrl+A' },
					{ separator: true },
					{ label: 'Inspect', icon: 'i-lucide-code', shortcut: 'F12', disabled: true },
				]}
			>
				{#snippet trigger({ props })}
					<div {...props} class="context-zone">
						<span class="i-lucide-mouse-pointer-click h-6 w-6 text-muted" />
						<span>Right-click anywhere in this area</span>
					</div>
				{/snippet}
			</ContextMenu>
		</DemoCard>

		<DemoCard
			title="Dynamic Context Menu"
			description="Menu items change based on content state. Right-click the cards below."
		>
			<div class="context-cards">
				<ContextMenu
					items={[
						{ label: 'Open', icon: 'i-lucide-external-link' },
						{ label: 'Edit', icon: 'i-lucide-pencil' },
						{ label: 'Duplicate', icon: 'i-lucide-copy' },
						{ separator: true },
						{ label: 'Pin to Top', icon: 'i-lucide-pin' },
						{ separator: true },
						{ label: 'Delete', icon: 'i-lucide-trash-2' },
					]}
				>
					{#snippet trigger({ props })}
						<div {...props} class="context-card">
							<span class="i-lucide-file-text h-5 w-5 text-primary" />
							<span class="context-card-title">Document</span>
							<span class="context-card-meta">Editable</span>
						</div>
					{/snippet}
				</ContextMenu>

				<ContextMenu
					items={[
						{ label: 'View', icon: 'i-lucide-eye' },
						{ label: 'Download', icon: 'i-lucide-download' },
						{ separator: true },
						{ label: 'Share Link', icon: 'i-lucide-share-2' },
						{ separator: true },
						{ label: 'Delete', icon: 'i-lucide-trash-2' },
					]}
				>
					{#snippet trigger({ props })}
						<div {...props} class="context-card">
							<span class="i-lucide-image h-5 w-5 text-primary" />
							<span class="context-card-title">Image</span>
							<span class="context-card-meta">Read-only</span>
						</div>
					{/snippet}
				</ContextMenu>

				<ContextMenu
					items={[
						{ label: 'Open in Editor', icon: 'i-lucide-code' },
						{ label: 'View Raw', icon: 'i-lucide-file-code' },
						{ separator: true },
						{ label: 'Copy Path', icon: 'i-lucide-clipboard-copy' },
						{ label: 'Blame', icon: 'i-lucide-git-branch' },
					]}
				>
					{#snippet trigger({ props })}
						<div {...props} class="context-card">
							<span class="i-lucide-file-code h-5 w-5 text-primary" />
							<span class="context-card-title">Source Code</span>
							<span class="context-card-meta">Developer</span>
						</div>
					{/snippet}
				</ContextMenu>
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

	/* Context zone */
	.context-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-3);
		width: 100%;
		height: 10rem;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: context-menu;
		transition: border-color var(--duration-fast);
	}

	.context-zone:hover {
		border-color: var(--color-primary);
		color: var(--color-fg);
	}

	/* Context cards */
	.context-cards {
		display: flex;
		gap: var(--spacing-4);
		flex-wrap: wrap;
		width: 100%;
	}

	.context-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: context-menu;
		min-width: 8rem;
		transition: border-color var(--duration-fast);
	}

	.context-card:hover {
		border-color: var(--color-primary);
	}

	.context-card-title {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}

	.context-card-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
