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
		{ label: 'Pattern Library', href: '/docs/pattern-library' },
		{ label: data.entry.title },
	]}
	backHref="/docs/pattern-library"
	backLabel="Pattern Library"
/>
