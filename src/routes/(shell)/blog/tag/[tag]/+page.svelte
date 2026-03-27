<script lang="ts">
import { PageContainer, Stack } from '$lib/components/layout';
import { PageHeader, EmptyState } from '$lib/components/composites';
import { PostList } from '$lib/components/blog';

let { data } = $props();
</script>

<svelte:head>
	<title>Posts tagged "{data.tagName}" - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7 pb-8">
	<Stack class="gap-7">
		<PageHeader
			title='Posts tagged "{data.tagName}"'
			breadcrumbs={[
				{ label: 'Home', href: '/' },
				{ label: 'Blog', href: '/blog' },
				{ label: data.tagName },
			]}
		/>

		{#if data.posts.length > 0}
			<PostList
				posts={data.posts}
				page={data.page}
				totalPages={data.totalPages}
				basePath={`/blog/tag/${data.tagSlug}`}
			/>
		{:else}
			<EmptyState
				icon="i-lucide-tag"
				title="No posts with this tag"
				description={`Published posts tagged with "${data.tagName}" will appear here.`}
			/>
		{/if}
	</Stack>
</PageContainer>
