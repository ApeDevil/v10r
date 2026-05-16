<script lang="ts">
import { PostList } from '$lib/components/blog';
import { EmptyState, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';

let { data } = $props();
</script>
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
