<script lang="ts">
import DocLeaf from '$lib/components/docs/DocLeaf.svelte';

let { data } = $props();
</script>

<DocLeaf
	entry={data.entry}
	html={data.html}
	toc={data.toc}
	sourceUrl={data.sourceUrl}
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Docs', href: '/docs' },
		{ label: 'Foundation', href: '/docs/foundation' },
		{ label: data.entry.title },
	]}
	backHref="/docs/foundation"
	backLabel="Foundation"
/>
