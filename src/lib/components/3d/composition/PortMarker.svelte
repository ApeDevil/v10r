<script lang="ts" module>
import { ConeGeometry, MeshBasicMaterial, SphereGeometry } from 'three';

// One geometry per shape for every marker in every scene; only materials vary.
const KNOB = new SphereGeometry(0.022, 16, 12);
const ARROW = new ConeGeometry(0.014, 0.04, 12);
/** Invisible, larger than the knob: a port is a small target, above all on touch. */
const HIT = new SphereGeometry(0.06, 8, 6);
const HIT_MATERIAL = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/**
 * How a port is drawn: `open` and `coupled` by use, `selected` by the viewer, and — while
 * another port is selected — `candidate` (it would couple) or `blocked` (it would be refused).
 */
export type PortEmphasis = 'open' | 'coupled' | 'selected' | 'candidate' | 'blocked';

const SCALE: Record<PortEmphasis, number> = { open: 1, coupled: 0.6, selected: 1.4, candidate: 1.3, blocked: 0.7 };
</script>

<script lang="ts">
import { T } from '@threlte/core';
import type { ResolvedPort } from '#lib/product-composition/index.ts';

interface Props {
	port: ResolvedPort;
	color: string;
	emphasis: PortEmphasis;
	/** Absent for a port only its subassembly can reach: drawn, but not pickable. */
	onpick?: (port: ResolvedPort) => void;
}

let { port, color, emphasis, onpick }: Props = $props();

const scale = $derived(SCALE[emphasis]);
const opacity = $derived(emphasis === 'blocked' ? 0.25 : 1);

function pick(event: { stopPropagation: () => void }) {
	event.stopPropagation();
	onpick?.(port);
}
</script>

<T.Group position={port.frame.position} quaternion={port.frame.rotation}>
	<T.Mesh geometry={KNOB} scale={scale}>
		<T.MeshBasicMaterial {color} {opacity} transparent={opacity < 1} toneMapped={false} />
	</T.Mesh>
	<!-- The arrow points along the port's outward +Z (a cone points along +Y; a quarter turn about X). -->
	<T.Mesh geometry={ARROW} position={[0, 0, 0.04 * scale]} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
		<T.MeshBasicMaterial {color} {opacity} transparent={opacity < 1} toneMapped={false} />
	</T.Mesh>
	{#if onpick}
		<T.Mesh geometry={HIT} material={HIT_MATERIAL} onclick={pick} />
	{/if}
</T.Group>
