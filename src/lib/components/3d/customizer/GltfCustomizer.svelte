<script lang="ts">
	/**
	 * Bridge component that lives inside <Canvas>, loads the GLTF (cached),
	 * and passes the scene + parser to CustomizerLayer.
	 */
	import { useGltf } from '@threlte/extras';
	import type { CustomizationConfig, CustomizationState } from '$lib/config/customization';
	import CustomizerLayer from './CustomizerLayer.svelte';

	interface Props {
		modelPath: string;
		config: CustomizationConfig;
		currentState: CustomizationState;
	}

	let { modelPath, config, currentState }: Props = $props();

	const gltf = useGltf(modelPath);
</script>

{#if $gltf}
	<CustomizerLayer scene={$gltf.scene} parser={$gltf.parser} {config} {currentState} />
{/if}
