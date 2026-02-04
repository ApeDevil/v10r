<script lang="ts">
	interface Breadcrumb {
		label: string;
		href?: string;
	}

	interface Props {
		title: string;
		description?: string;
		breadcrumbs?: Breadcrumb[];
		sticky?: boolean;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { title, description, breadcrumbs = [], sticky = false, class: className, children }: Props = $props();

	// Ensure last breadcrumb is current (no link)
	const processedBreadcrumbs = $derived(
		breadcrumbs.map((b, i) => ({
			...b,
			href: i === breadcrumbs.length - 1 ? undefined : b.href
		}))
	);
</script>

<header
	class="page-header {sticky ? 'sticky' : ''} {className || ''}"
	role="banner"
>
	{#if breadcrumbs.length > 0}
		<nav class="breadcrumbs" aria-label="Breadcrumb">
			<ol>
				{#each processedBreadcrumbs as breadcrumb, i}
					<li>
						{#if breadcrumb.href}
							<a href={breadcrumb.href}>{breadcrumb.label}</a>
						{:else}
							<span aria-current="page">{breadcrumb.label}</span>
						{/if}
						{#if i < processedBreadcrumbs.length - 1}
							<span class="separator" aria-hidden="true">/</span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	{/if}

	<div class="header-content">
		<div class="header-text">
			<h1>{title}</h1>
			{#if description}
				<p class="description">{description}</p>
			{/if}
		</div>

		{#if children}
			<div class="header-actions">
				{@render children()}
			</div>
		{/if}
	</div>
</header>

<style>
	.page-header {
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		padding: var(--spacing-6) var(--spacing-7);
		margin: calc(-1 * var(--spacing-7)) calc(-1 * var(--spacing-7)) var(--spacing-7) calc(-1 * var(--spacing-7));
		width: calc(100% + var(--spacing-7) * 2);
		box-sizing: border-box;
	}

	.page-header.sticky {
		position: sticky;
		top: 0;
		z-index: var(--z-sidebar);
		backdrop-filter: blur(8px);
		background: var(--color-bg-alpha);
	}

	.breadcrumbs {
		margin-bottom: var(--spacing-4);
	}

	.breadcrumbs ol {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: var(--spacing-2);
	}

	.breadcrumbs li {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.breadcrumbs a {
		color: var(--color-primary);
		text-decoration: none;
		transition: color var(--duration-fast);
	}

	.breadcrumbs a:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	.breadcrumbs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.breadcrumbs span[aria-current] {
		color: var(--color-muted);
		font-weight: 500;
	}

	.separator {
		color: var(--color-muted);
		user-select: none;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-7);
	}

	.header-text {
		flex: 1;
		min-width: 0;
	}

	h1 {
		font-size: var(--text-fluid-3xl);
		font-weight: 700;
		margin: 0;
		color: var(--color-fg);
		word-wrap: break-word;
	}

	.description {
		margin: var(--spacing-2) 0 0 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.page-header {
			padding: var(--spacing-4) var(--spacing-4);
			margin: calc(-1 * var(--spacing-4)) calc(-1 * var(--spacing-4)) var(--spacing-4) calc(-1 * var(--spacing-4));
			width: calc(100% + var(--spacing-4) * 2);
		}

		.header-content {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--spacing-4);
		}

		.header-actions {
			width: 100%;
			flex-wrap: wrap;
		}
	}
</style>
