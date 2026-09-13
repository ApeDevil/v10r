<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab, PageHeader, ShowcaseDocs } from '$lib/components/composites';
import { PageContainer } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';
import type { ShowcaseCard } from '$lib/showcases/catalog/registry';

interface Props {
	/** Registry card — the single source for title/description/breadcrumbs/tabs/aria. */
	card: ShowcaseCard;
	/** PageContainer width prop (default: 'default') */
	width?: 'content' | 'default' | 'wide';
	/** Override PageContainer class (default: 'py-7') */
	containerClass?: string;
	/** Extra class on the children wrapper div */
	wrapperClass?: string;
	/** A tighter header and less room above the content — for a showcase whose first section is the point. */
	compact?: boolean;
	children: Snippet;
}

let { card, width = 'default', containerClass = 'py-7', wrapperClass, compact = false, children }: Props = $props();
const wrapperPadding = $derived(compact ? 'pt-3' : 'pt-6');

const title = card.title();
const description = card.description();
const breadcrumbs = [
	{ label: m.showcase_breadcrumb_home(), href: '/' },
	{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
	{ label: (card.breadcrumbLabel ?? card.title)() },
];
const tabs = (card.sublinks ?? []).map((s) => ({ label: s.label(), href: s.href }));
const ariaLabel = (card.ariaLabel ?? card.title)();
</script>

<PageContainer {width} class={containerClass}>
	<PageHeader {title} {description} {breadcrumbs} {compact}>
		<ShowcaseDocs />
	</PageHeader>

	{#if tabs.length > 0}
		<NavTab {tabs} {ariaLabel} />
	{/if}

	<div class={wrapperClass ? `${wrapperPadding} ${wrapperClass}` : wrapperPadding}>
		{@render children()}
	</div>
</PageContainer>
