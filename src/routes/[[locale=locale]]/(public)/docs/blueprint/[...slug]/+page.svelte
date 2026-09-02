<script lang="ts">
import DocPage from '$lib/components/docs/DocPage.svelte';

let { data } = $props();
</script>

<DocPage
	entry={data.entry}
	html={data.html}
	toc={data.toc}
	sourceUrl={data.sourceUrl}
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Docs', href: '/docs' },
		{ label: 'Blueprint', href: '/docs/blueprint' },
		{ label: data.entry.title },
	]}
	backHref="/docs/blueprint"
	backLabel="Blueprint"
/>
