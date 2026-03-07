<script lang="ts">
	import { CommandPalette } from '../command-palette';
	import type { QuickSearchItem } from './types';
	import type { CommandPaletteItem } from '../command-palette/types';

	interface Props {
		open: boolean;
		items: QuickSearchItem[];
	}

	let { open = $bindable(false), items }: Props = $props();

	// QuickSearchItem and CommandPaletteItem are shape-compatible
	let paletteItems: CommandPaletteItem[] = $derived(
		items.map((item) => ({
			...item,
			action: item.action,
			shortcut: undefined,
		})) as CommandPaletteItem[],
	);
</script>

<CommandPalette bind:open items={paletteItems} />
