<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Storage - Database - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Storage"
		description="Cloudflare R2 object storage — presigned URLs, file uploads, byte-range requests, and bucket management."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Storage' }
		]}
	/>

	<nav class="r2-nav">
		<LinkCard
			href="/showcases/db/storage/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="R2 health check, bucket info, latency measurement, and seed data management"
		/>
		<LinkCard
			href="/showcases/db/storage/objects"
			icon="i-lucide-folder-open"
			title="Objects"
			description="Browse objects, inspect metadata, and generate presigned download URLs"
		/>
		<LinkCard
			href="/showcases/db/storage/transfer"
			icon="i-lucide-upload"
			title="Transfer"
			description="Presigned URL uploads, byte-range requests, and MIME type enforcement"
		/>
	</nav>

	<BackLink href="/showcases/db" label="Database" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.r2-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
