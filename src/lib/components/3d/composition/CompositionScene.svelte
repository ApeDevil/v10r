<script lang="ts" module>
import type { PortRef, PortStandard, ProductComposition, Vec3 } from '$lib/product-composition';

/** What the viewer has picked: a top-level occurrence, a port, or a conduit coupling. */
export type CompositionSelection =
	| { kind: 'occurrence'; id: string }
	| { kind: 'port'; key: string; ref?: PortRef }
	| { kind: 'conduit'; coupling: string }
	| null;

/** Drag callbacks. With them, the selected occurrence or waypoint gets a translate gizmo. */
export interface GizmoHandlers {
	onstart: () => void;
	onoccurrence: (id: string, position: Vec3) => void;
	onwaypoint: (coupling: string, index: number, position: Vec3) => void;
	onend: () => void;
}

export interface CompositionSceneProps {
	composition: ProductComposition;
	standards: readonly PortStandard[];
	selection: CompositionSelection;
	onselect: (selection: CompositionSelection) => void;
	/** Port key → how it reads against the selected port. */
	portHints?: ReadonlyMap<string, 'candidate' | 'blocked'>;
	/** The selected waypoint of the selected conduit. */
	waypoint?: number;
	onwaypointselect?: (index: number) => void;
	gizmo?: GizmoHandlers;
	/** Bump to fit the camera to everything drawn. */
	frameRequest?: number;
}
</script>

<script lang="ts">
import { T, useThrelte } from '@threlte/core';
import { CameraControls, type CameraControlsRef, interactivity, TransformControls } from '@threlte/extras';
import { Box3, type Group, Vector3 } from 'three';
import {
	conduitPolyline,
	portUse,
	resolveComposition,
	resolvePort,
} from '$lib/product-composition';
import { THRELTE_MAKE_DEFAULT } from '$lib/utils/threlte-workarounds';
import { FALLBACK_TOKEN, SCENE_TOKENS, SELECTION_TOKEN, standardTokens } from './composition-palette';
import ConduitMesh from './ConduitMesh.svelte';
import OccurrenceMesh from './OccurrenceMesh.svelte';
import PortMarker, { type PortEmphasis } from './PortMarker.svelte';
import { colorOf, themeColors } from './theme-colors.svelte';

let {
	composition,
	standards,
	selection,
	onselect,
	portHints,
	waypoint,
	onwaypointselect,
	gizmo,
	frameRequest = 0,
}: CompositionSceneProps = $props();

interactivity();
const { invalidate } = useThrelte();
const colors = themeColors(SCENE_TOKENS);

const resolution = $derived(resolveComposition(composition));
const tokens = $derived(standardTokens(standards));
const used = $derived(portUse(composition));
const conduits = $derived(
	composition.couplings.flatMap((coupling) => {
		const polyline = conduitPolyline(composition, coupling.id);
		const standard = resolvePort(composition, coupling.a)?.port.standard;
		return polyline ? [{ coupling: coupling.id, points: polyline.points, token: tokens.get(standard ?? '') }] : [];
	}),
);

const selectedOccurrence = $derived(selection?.kind === 'occurrence' ? selection.id : undefined);
const selectedPort = $derived(selection?.kind === 'port' ? selection.key : undefined);
const selectedConduit = $derived(selection?.kind === 'conduit' ? selection.coupling : undefined);
const waypoints = $derived(
	composition.conduits.find((conduit) => conduit.coupling === selectedConduit)?.waypoints ?? [],
);
const tokenColor = (token: string | undefined) => colorOf(colors, token ?? FALLBACK_TOKEN);

function emphasisOf(key: string): PortEmphasis {
	if (key === selectedPort) return 'selected';
	const hint = portHints?.get(key);
	if (hint) return hint;
	return used.has(key) ? 'coupled' : 'open';
}

/** What the gizmo moves: the selected occurrence, or the selected waypoint of the selected conduit. */
const target = $derived.by(() => {
	if (!gizmo) return undefined;
	if (selectedOccurrence) {
		const occurrence = composition.occurrences.find((candidate) => candidate.id === selectedOccurrence);
		return occurrence && { key: `occurrence:${occurrence.id}`, position: occurrence.placement.position };
	}
	if (selectedConduit && waypoint !== undefined && waypoints[waypoint]) {
		return { key: `waypoint:${selectedConduit}:${waypoint}`, position: waypoints[waypoint] };
	}
	return undefined;
});

let proxy = $state<Group>();
let controls = $state<CameraControlsRef>();

// Threlte 9.7's TransformControls pauses OrbitControls but not CameraControls: pause by hand.
function dragStart() {
	if (controls) controls.enabled = false;
	gizmo?.onstart();
}
function dragEnd() {
	if (controls) controls.enabled = true;
	gizmo?.onend();
}
function dragMove() {
	if (!proxy || !gizmo) return;
	const position: Vec3 = [proxy.position.x, proxy.position.y, proxy.position.z];
	if (selectedOccurrence) gizmo.onoccurrence(selectedOccurrence, position);
	else if (selectedConduit && waypoint !== undefined) gizmo.onwaypoint(selectedConduit, waypoint, position);
}

// On-demand rendering: draw again whenever the document, the selection or the theme changes.
$effect(() => {
	void composition;
	void selection;
	void waypoint;
	void portHints;
	void Object.values(colors);
	invalidate();
});

/** Fit the camera to a box, from a three-quarter view in front of it. */
function frame(box: Box3, smooth: boolean) {
	if (!controls || box.isEmpty()) return;
	const center = box.getCenter(new Vector3());
	controls.setLookAt(center.x + 2, center.y + 2, center.z + 6, center.x, center.y, center.z, false);
	void controls.fitToBox(box, smooth, { paddingTop: 0.1, paddingBottom: 0.1, paddingLeft: 0.1, paddingRight: 0.1 });
}

// Frame each composition once when it first appears, from its products' origins and ports.
let framed: string | undefined;
$effect(() => {
	if (!controls || framed === composition.id) return;
	framed = composition.id;
	const box = new Box3();
	for (const leaf of resolution.occurrences) box.expandByPoint(new Vector3(...leaf.placement.position));
	for (const port of resolution.ports) box.expandByPoint(new Vector3(...port.frame.position));
	frame(box.expandByScalar(0.4), false);
});

// "Frame all": the full extent of everything drawn, models included, once they have loaded.
let scene = $state<Group>();
$effect(() => {
	if (frameRequest > 0 && scene) frame(new Box3().setFromObject(scene), true);
});
</script>

<T.PerspectiveCamera makeDefault={THRELTE_MAKE_DEFAULT} position={[2, 2.5, 6]} fov={40} near={0.05} far={200}>
	<CameraControls bind:ref={controls} />
</T.PerspectiveCamera>
<T.DirectionalLight position={[4, 8, 6]} intensity={1.4} />
<T.AmbientLight intensity={0.7} />

<T.Group bind:ref={scene} onpointermissed={() => onselect(null)}>
	{#each resolution.occurrences as leaf (leaf.path)}
		<OccurrenceMesh
			{leaf}
			{colors}
			selected={leaf.occurrence === selectedOccurrence}
			onpick={(id) => onselect({ kind: 'occurrence', id })}
		/>
	{/each}

	{#each resolution.ports as port (port.key)}
		<PortMarker
			{port}
			color={port.key === selectedPort ? tokenColor(SELECTION_TOKEN) : tokenColor(tokens.get(port.port.standard))}
			emphasis={emphasisOf(port.key)}
			onpick={port.ref ? (picked) => onselect({ kind: 'port', key: picked.key, ref: picked.ref }) : undefined}
		/>
	{/each}

	{#each conduits as conduit (conduit.coupling)}
		<ConduitMesh
			points={conduit.points}
			color={tokenColor(conduit.token)}
			selected={conduit.coupling === selectedConduit}
			onpick={() => onselect({ kind: 'conduit', coupling: conduit.coupling })}
		/>
	{/each}

	{#each waypoints as point, index (index)}
		<T.Mesh
			position={point}
			onclick={(event: { stopPropagation: () => void }) => {
				event.stopPropagation();
				onwaypointselect?.(index);
			}}
		>
			<T.SphereGeometry args={[index === waypoint ? 0.04 : 0.03, 16, 12]} />
			<T.MeshBasicMaterial color={tokenColor(SELECTION_TOKEN)} toneMapped={false} />
		</T.Mesh>
	{/each}
</T.Group>

{#if target}
	{#key target.key}
		<T.Group bind:ref={proxy} position={target.position} />
		{#if proxy}
			<TransformControls
				object={proxy}
				mode="translate"
				size={0.8}
				onmouseDown={dragStart}
				onmouseUp={dragEnd}
				onobjectChange={dragMove}
			/>
		{/if}
	{/key}
{/if}
