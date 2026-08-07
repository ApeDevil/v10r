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
		{ label: 'Pattern Library', href: '/docs/pattern-library' },
		{ label: data.entry.title },
	]}
	backHref="/docs/pattern-library"
	backLabel="Pattern Library"
/>
