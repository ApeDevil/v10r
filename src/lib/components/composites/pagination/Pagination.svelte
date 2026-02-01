<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import Icon from '@iconify/svelte';
	import { Button } from '$lib/components/primitives';

	interface Props {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		showFirstLast?: boolean;
		maxPages?: number;
		class?: string;
	}

	let {
		currentPage,
		totalPages,
		onPageChange,
		showFirstLast = true,
		maxPages = 7,
		class: className
	}: Props = $props();

	// Generate page numbers with ellipsis
	let pages = $derived(() => {
		const result: (number | 'ellipsis')[] = [];

		if (totalPages <= maxPages) {
			// Show all pages
			for (let i = 1; i <= totalPages; i++) {
				result.push(i);
			}
		} else {
			// Always show first page
			result.push(1);

			const leftSiblingIndex = Math.max(currentPage - 1, 2);
			const rightSiblingIndex = Math.min(currentPage + 1, totalPages - 1);

			const showLeftEllipsis = leftSiblingIndex > 2;
			const showRightEllipsis = rightSiblingIndex < totalPages - 1;

			if (!showLeftEllipsis && showRightEllipsis) {
				// Show pages from start
				const leftItemCount = 3 + 2;
				for (let i = 2; i <= leftItemCount; i++) {
					result.push(i);
				}
				result.push('ellipsis');
			} else if (showLeftEllipsis && !showRightEllipsis) {
				// Show pages from end
				result.push('ellipsis');
				const rightItemCount = 3 + 2;
				for (let i = totalPages - rightItemCount + 1; i < totalPages; i++) {
					result.push(i);
				}
			} else {
				// Show ellipsis on both sides
				result.push('ellipsis');
				for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
					result.push(i);
				}
				result.push('ellipsis');
			}

			// Always show last page
			result.push(totalPages);
		}

		return result;
	});

	function handlePageChange(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			onPageChange(page);
		}
	}
</script>

<nav class={cn('flex items-center justify-center gap-1', className)} aria-label="Pagination">
	{#if showFirstLast}
		<Button
			variant="ghost"
			size="icon"
			onclick={() => handlePageChange(1)}
			disabled={currentPage === 1}
			aria-label="First page"
		>
			<Icon icon="lucide:chevrons-left" class="h-4 w-4" />
		</Button>
	{/if}

	<Button
		variant="ghost"
		size="icon"
		onclick={() => handlePageChange(currentPage - 1)}
		disabled={currentPage === 1}
		aria-label="Previous page"
	>
		<Icon icon="lucide:chevron-left" class="h-4 w-4" />
	</Button>

	{#each pages() as page}
		{#if page === 'ellipsis'}
			<span class="flex h-10 w-10 items-center justify-center text-muted" aria-hidden="true">
				…
			</span>
		{:else}
			<Button
				variant={currentPage === page ? 'default' : 'ghost'}
				size="icon"
				onclick={() => handlePageChange(page)}
				aria-label={`Page ${page}`}
				aria-current={currentPage === page ? 'page' : undefined}
			>
				{page}
			</Button>
		{/if}
	{/each}

	<Button
		variant="ghost"
		size="icon"
		onclick={() => handlePageChange(currentPage + 1)}
		disabled={currentPage === totalPages}
		aria-label="Next page"
	>
		<Icon icon="lucide:chevron-right" class="h-4 w-4" />
	</Button>

	{#if showFirstLast}
		<Button
			variant="ghost"
			size="icon"
			onclick={() => handlePageChange(totalPages)}
			disabled={currentPage === totalPages}
			aria-label="Last page"
		>
			<Icon icon="lucide:chevrons-right" class="h-4 w-4" />
		</Button>
	{/if}
</nav>
