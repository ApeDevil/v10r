<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { localizeHref, deLocalizeHref } from '$lib/i18n';

	interface Tab {
		label: string;
		href: string;
		icon?: string;
	}

	interface Props {
		tabs: Tab[];
		ariaLabel?: string;
	}

	let { tabs, ariaLabel = 'Section navigation' }: Props = $props();

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
		{#each tabs as tab}
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
	</div>
</nav>

<style>
	.tab-nav {
		overflow: hidden;
	}

	.tab-list {
		display: inline-flex;
		align-items: center;
		overflow-x: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
		border-bottom: 1px solid var(--color-input-border);
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
		margin-bottom: -1px;
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
