<script lang="ts">
import { PostList } from '$lib/components/blog';
import { EmptyState, LocaleFallbackBanner, PageHeader } from '$lib/components/composites';
import { PageContainer, Stack } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>
<PageContainer width="wide" class="pt-7 pb-8">
	<Stack class="gap-7">
		<PageHeader
			title={m.blog_title()}
			description={m.blog_description()}
			breadcrumbs={[
				{ label: m.showcase_breadcrumb_home(), href: '/' },
				{ label: m.blog_breadcrumb_blog() },
			]}
		/>

		{#if data.localeFallback}
			<LocaleFallbackBanner />
		{/if}

		{#if data.posts.length > 0}
			<PostList
				posts={data.posts}
				page={data.page}
				totalPages={data.totalPages}
			/>
		{:else}
			<EmptyState
				icon="i-lucide-newspaper"
				title={m.blog_empty_title()}
				description={m.blog_empty_description()}
			/>
		{/if}
	</Stack>
</PageContainer>
