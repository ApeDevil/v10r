<script lang="ts">
import DocPage from '$lib/components/docs/DocPage.svelte';

let { data } = $props();
</script>

<DocPage
	entry={{ title: data.doc.title, description: data.doc.description }}
	html={data.html}
	toc={data.toc}
	sourceUrl={data.sourceUrl}
	markdownHref="/docs/{data.doc.slug}.md"
	breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: data.doc.title }]}
	backHref="/docs"
	backLabel="Docs"
/>
