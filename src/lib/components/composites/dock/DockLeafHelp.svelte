<script lang="ts">
	import { InfoDialog } from '$lib/components/composites/info-dialog';
	import { DESK_PANEL_HELP } from '$lib/config/desk-help';

	interface Props {
		panelType: string | null;
	}

	let { panelType }: Props = $props();

	const panelHelp = $derived(
		panelType ? DESK_PANEL_HELP[panelType as keyof typeof DESK_PANEL_HELP] ?? null : null,
	);
</script>

{#if panelHelp}
	<InfoDialog
		title={panelHelp.title}
		description={panelHelp.description}
		icon={panelHelp.icon}
		ariaLabel="About {panelHelp.title}"
		doc={{ name: panelHelp.title, notes: panelHelp.notes }}
	/>
{/if}
