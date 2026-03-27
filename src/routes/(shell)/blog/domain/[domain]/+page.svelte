<script lang="ts">
import { PageContainer, Stack } from '$lib/components/layout';
import { PageHeader, EmptyState } from '$lib/components/composites';
import { PostList } from '$lib/components/blog';

let { data } = $props();
</script>

<svelte:head>
	<title>{data.domainName} - Blog - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7 pb-8">
	<Stack class="gap-7">
		<PageHeader
			title={data.domainName}
			description={`Posts in the ${data.domainName} domain.`}
			breadcrumbs={[
				{ label: 'Home', href: '/' },
				{ label: 'Blog', href: '/blog' },
				{ label: data.domainName },
			]}
		/>

		{#if data.posts.length > 0}
			<PostList
				posts={data.posts}
				page={data.page}
				totalPages={data.totalPages}
				basePath={`/blog/domain/${data.domainSlug}`}
			/>
		{:else}
			<EmptyState
				icon="i-lucide-folder"
				title="No posts in this domain"
				description={`Published posts in "${data.domainName}" will appear here.`}
			/>
		{/if}
	</Stack>
</PageContainer>
