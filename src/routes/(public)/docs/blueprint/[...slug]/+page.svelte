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
		{ label: 'Blueprint', href: '/docs/blueprint' },
		{ label: data.entry.title },
	]}
	backHref="/docs/blueprint"
	backLabel="Blueprint"
/>
