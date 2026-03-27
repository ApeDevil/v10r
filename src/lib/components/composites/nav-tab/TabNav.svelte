<script lang="ts">
import { browser } from '$app/environment';
import { page } from '$app/state';
import { deLocalizeHref, localizeHref } from '$lib/i18n';

interface Tab {
	label: string;
	href: string;
	icon?: string;
}

interface TabGroup {
	label: string;
	tabs: Tab[];
}

interface Props {
	tabs?: Tab[];
	groups?: TabGroup[];
	ariaLabel?: string;
}

let { tabs, groups, ariaLabel = 'Section navigation' }: Props = $props();

const allTabs = $derived(groups ? groups.flatMap((g) => g.tabs) : tabs ?? []);

let chipsEl: HTMLElement | undefined = $state();
let canScrollRight = $state(false);
let canScrollLeft = $state(false);

function isActive(href: string): boolean {
	return page.url.pathname.startsWith(deLocalizeHref(href));
}

// Track horizontal scroll overflow for fade indicators
$effect(() => {
	if (!browser || !chipsEl) return;

	function updateOverflow() {
		if (!chipsEl) return;
		const { scrollLeft, scrollWidth, clientWidth } = chipsEl;
		canScrollLeft = scrollLeft > 1;
		canScrollRight = scrollLeft + clientWidth < scrollWidth - 1;
	}

	function handleWheel(e: WheelEvent) {
		if (!chipsEl || chipsEl.scrollWidth <= chipsEl.clientWidth) return;
		if (e.deltaY !== 0) {
			e.preventDefault();
			chipsEl.scrollLeft += e.deltaY;
		}
	}

	chipsEl.addEventListener('scroll', updateOverflow, { passive: true });
	chipsEl.addEventListener('wheel', handleWheel, { passive: false });
	const ro = new ResizeObserver(updateOverflow);
	ro.observe(chipsEl);
	updateOverflow();

	return () => {
		chipsEl?.removeEventListener('scroll', updateOverflow);
		chipsEl?.removeEventListener('wheel', handleWheel);
		ro.disconnect();
	};
});
</script>

<nav class="tab-nav" aria-label={ariaLabel}>
	<div
		bind:this={chipsEl}
		class="tab-list"
		class:fade-left={canScrollLeft}
		class:fade-right={canScrollRight}
		role="tablist"
	>
		{#if groups}
			{#each groups as group, gi}
				{#if gi > 0}
					<span class="tab-divider" aria-hidden="true"></span>
				{/if}
				<span class="tab-group-label" aria-hidden="true">{group.label}</span>
				{#each group.tabs as tab}
					<a
						href={localizeHref(tab.href)}
						class="tab-item"
						class:active={isActive(tab.href)}
						role="tab"
						aria-selected={isActive(tab.href)}
					>
						{#if tab.icon}
							<span class="{tab.icon} tab-icon" aria-hidden="true"></span>
						{/if}
						{tab.label}
					</a>
				{/each}
			{/each}
		{:else}
			{#each allTabs as tab}
				<a
					href={localizeHref(tab.href)}
					class="tab-item"
					class:active={isActive(tab.href)}
					role="tab"
					aria-selected={isActive(tab.href)}
				>
					{#if tab.icon}
						<span class="{tab.icon} tab-icon" aria-hidden="true"></span>
					{/if}
					{tab.label}
				</a>
			{/each}
		{/if}
	</div>
</nav>

<style>
	.tab-nav {
		position: relative;
		overflow: hidden;
	}

	/* Full-width baseline — sits behind the scroll container */
	.tab-nav::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--color-input-border);
		pointer-events: none;
		z-index: 0;
	}

	.tab-list {
		display: flex;
		align-items: center;
		position: relative;
		z-index: 1;
		overflow-x: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		/* Fade masks for overflow indicators */
		mask-image: linear-gradient(to right, transparent 0%, black 0%, black 100%, transparent 100%);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black 100%,
			transparent 100%
		);
	}

	.tab-list::-webkit-scrollbar {
		display: none;
	}

	.tab-list.fade-left {
		mask-image: linear-gradient(to right, transparent 0%, black 32px, black 100%, transparent 100%);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black 100%,
			transparent 100%
		);
	}

	.tab-list.fade-right {
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black calc(100% - 32px),
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 0%,
			black calc(100% - 32px),
			transparent 100%
		);
	}

	.tab-list.fade-left.fade-right {
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black calc(100% - 32px),
			transparent 100%
		);
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			black 32px,
			black calc(100% - 32px),
			transparent 100%
		);
	}

	.tab-group-label {
		flex-shrink: 0;
		padding: var(--spacing-2) var(--spacing-2) var(--spacing-2) var(--spacing-3);
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		white-space: nowrap;
		user-select: none;
	}

	.tab-divider {
		flex-shrink: 0;
		width: 1px;
		height: 1.25rem;
		background: var(--color-input-border);
		margin-inline: var(--spacing-1);
	}

	.tab-item {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: border-bottom-color 150ms ease, color 150ms ease;
	}

	.tab-item:hover {
		color: var(--color-fg);
	}

	.tab-item.active {
		border-bottom-color: var(--color-primary);
		color: var(--color-primary);
	}

	.tab-item:focus-visible {
		outline: none;
		border-bottom-color: var(--color-primary);
	}

	.tab-icon {
		font-size: 1em;
	}
</style>
