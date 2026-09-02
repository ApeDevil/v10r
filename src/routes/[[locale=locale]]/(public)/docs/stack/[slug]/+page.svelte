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
		{ label: 'Stack', href: '/docs/stack' },
		{ label: data.entry.title },
	]}
	backHref="/docs/stack"
	backLabel="Stack"
/>
