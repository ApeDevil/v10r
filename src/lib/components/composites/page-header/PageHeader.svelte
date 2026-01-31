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
		padding: 1.5rem 2rem;
		margin: -2rem -2rem 2rem -2rem;
	}

	.page-header.sticky {
		position: sticky;
		top: 0;
		z-index: 10;
		backdrop-filter: blur(8px);
		background: var(--color-bg-alpha, rgba(255, 255, 255, 0.95));
	}

	.breadcrumbs {
		margin-bottom: 1rem;
	}

	.breadcrumbs ol {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0.5rem;
	}

	.breadcrumbs li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.breadcrumbs a {
		color: var(--color-primary);
		text-decoration: none;
		transition: color 0.2s;
	}

	.breadcrumbs a:hover {
		color: var(--color-primary-hover);
		text-decoration: underline;
	}

	.breadcrumbs a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
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
		gap: 2rem;
	}

	.header-text {
		flex: 1;
		min-width: 0;
	}

	h1 {
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		font-weight: 700;
		margin: 0;
		color: var(--color-fg);
		word-wrap: break-word;
	}

	.description {
		margin: 0.5rem 0 0 0;
		font-size: 1rem;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.page-header {
			padding: 1rem 1rem;
			margin: -1rem -1rem 1rem -1rem;
		}

		.header-content {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.header-actions {
			width: 100%;
			flex-wrap: wrap;
		}
	}
</style>
