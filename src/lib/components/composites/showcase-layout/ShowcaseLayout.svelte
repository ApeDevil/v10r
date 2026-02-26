<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	interface Props {
		title: string;
		description: string;
		breadcrumbs: { label: string; href?: string }[];
		tabs: { label: string; href: string }[];
		ariaLabel: string;
		/** PageContainer width prop (default: 'default') */
		width?: 'content' | 'default' | 'wide';
		/** Override PageContainer class (default: 'py-7') */
		containerClass?: string;
		/** Extra class on the children wrapper div */
		wrapperClass?: string;
		children: Snippet;
	}

	let {
		title,
		description,
		breadcrumbs,
		tabs,
		ariaLabel,
		width = 'default',
		containerClass = 'py-7',
		wrapperClass,
		children,
	}: Props = $props();
</script>

<PageContainer {width} class={containerClass}>
	<PageHeader {title} {description} {breadcrumbs} />

	<TabNav {tabs} {ariaLabel} />

	<div class={wrapperClass ? `pt-6 ${wrapperClass}` : 'pt-6'}>
		{@render children()}
	</div>
</PageContainer>
