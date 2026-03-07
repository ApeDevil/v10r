<script lang="ts">
	import { NavSection } from '$lib/components/composites';
	import CommandPaletteSection from './_sections/CommandPaletteSection.svelte';
	import OverflowSection from './_sections/OverflowSection.svelte';
	import SelectionBarSection from './_sections/SelectionBarSection.svelte';
	import ContextMenuSection from './_sections/ContextMenuSection.svelte';
	import MenuBarSection from './_sections/MenuBarSection.svelte';

	const sections = [
		{ id: 'menu-command-palette', label: 'Command Palette' },
		{ id: 'menu-overflow', label: 'Overflow' },
		{ id: 'menu-selection-bar', label: 'Selection Bar' },
		{ id: 'menu-context', label: 'Context Menu' },
		{ id: 'menu-menubar', label: 'Menu Bar' },
	];
</script>

<svelte:head>
	<title>Menus - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<CommandPaletteSection />
	<OverflowSection />
	<SelectionBarSection />
	<ContextMenuSection />
	<MenuBarSection />
</main>
