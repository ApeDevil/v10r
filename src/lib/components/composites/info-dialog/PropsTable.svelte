<script lang="ts">
import { ScrollArea } from '$lib/components/primitives/scroll-area';
import {
	Table,
	Body as TableBody,
	Cell as TableCell,
	Header as TableHeader,
	HeaderCell as TableHeaderCell,
	Row as TableRow,
} from '$lib/components/primitives/table';
import { cn } from '$lib/utils/cn';
import type { PropDef } from './types';

interface Props {
	props: PropDef[];
	class?: string;
}

let { props, class: className }: Props = $props();
</script>

<ScrollArea orientation="horizontal" class={cn('props-table-scroll', className)}>
	<Table class="props-table">
		<TableHeader>
			<TableRow>
				<TableHeaderCell class="props-col-name">Name</TableHeaderCell>
				<TableHeaderCell class="props-col-type">Type</TableHeaderCell>
				<TableHeaderCell class="props-col-default">Default</TableHeaderCell>
				<TableHeaderCell class="props-col-desc">Description</TableHeaderCell>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#each props as prop}
				<TableRow>
					<TableCell class="props-name">
						{prop.name}{#if prop.required}<span class="props-required">*</span>{/if}
					</TableCell>
					<TableCell class="props-type">{prop.type}</TableCell>
					<TableCell class="props-default">{prop.default ?? '—'}</TableCell>
					<TableCell class="props-desc">{prop.description}</TableCell>
				</TableRow>
			{/each}
		</TableBody>
	</Table>
</ScrollArea>

<style>
	:global(.props-table-scroll) {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	:global(.props-table) {
		width: 100%;
		min-width: 32rem;
	}

	:global(.props-col-name) {
		width: 12%;
		white-space: nowrap;
	}

	:global(.props-col-type) {
		width: 28%;
	}

	:global(.props-col-default) {
		width: 10%;
		white-space: nowrap;
	}

	:global(.props-col-desc) {
		width: 50%;
	}

	:global(.props-name) {
		font-family: var(--font-mono, monospace);
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
	}

	.props-required {
		color: var(--color-warning, var(--color-primary));
		margin-left: 1px;
	}

	:global(.props-type) {
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		word-break: break-word;
	}

	:global(.props-default) {
		font-family: var(--font-mono, monospace);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	:global(.props-desc) {
		font-size: var(--text-fluid-sm);
		color: var(--color-body);
		line-height: 1.5;
	}
</style>
