<script lang="ts">
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';

interface Props {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	showFirstLast?: boolean;
	maxPages?: number;
	class?: string;
}

let { currentPage, totalPages, onPageChange, showFirstLast = true, maxPages = 7, class: className }: Props = $props();

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

<nav class={cn('flex items-center justify-center gap-1', className)} aria-label={m.composites_pagination_label()}>
	{#if showFirstLast}
		<Button
			variant="ghost"
			size="icon"
			class="focus-visible:ring-1"
			onclick={() => handlePageChange(1)}
			disabled={currentPage === 1}
			aria-label={m.composites_pagination_first()}
		>
			<span class="i-lucide-chevrons-left h-4 w-4" ></span>
		</Button>
	{/if}

	<Button
		variant="ghost"
		size="icon"
		class="focus-visible:ring-1"
		onclick={() => handlePageChange(currentPage - 1)}
		disabled={currentPage === 1}
		aria-label={m.composites_pagination_previous()}
	>
		<span class="i-lucide-chevron-left h-4 w-4" ></span>
	</Button>

	{#each pages() as page}
		{#if page === 'ellipsis'}
			<span class="flex h-10 w-10 items-center justify-center text-muted" aria-hidden="true">
				…
			</span>
		{:else}
			<Button
				variant={currentPage === page ? 'primary' : 'ghost'}
				size="icon"
				class="focus-visible:ring-1"
				onclick={() => handlePageChange(page)}
				aria-label={m.composites_pagination_page({ page })}
				aria-current={currentPage === page ? 'page' : undefined}
			>
				{page}
			</Button>
		{/if}
	{/each}

	<Button
		variant="ghost"
		size="icon"
		class="focus-visible:ring-1"
		onclick={() => handlePageChange(currentPage + 1)}
		disabled={currentPage === totalPages}
		aria-label={m.composites_pagination_next()}
	>
		<span class="i-lucide-chevron-right h-4 w-4" ></span>
	</Button>

	{#if showFirstLast}
		<Button
			variant="ghost"
			size="icon"
			class="focus-visible:ring-1"
			onclick={() => handlePageChange(totalPages)}
			disabled={currentPage === totalPages}
			aria-label={m.composites_pagination_last()}
		>
			<span class="i-lucide-chevrons-right h-4 w-4" ></span>
		</Button>
	{/if}
</nav>
