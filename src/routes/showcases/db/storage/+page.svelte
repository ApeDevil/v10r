<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
	import { PageContainer } from '$lib/components/layout';
</script>

<svelte:head>
	<title>Storage - Database - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
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

	<nav class="nav-grid">
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
</PageContainer>

<style>
	.nav-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
