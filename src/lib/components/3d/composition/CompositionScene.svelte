<script lang="ts" module>
import type { PortRef, PortStandard, ProductComposition, Vec3 } from '#lib/product-composition/index.ts';
import type { RoomLayout } from './RoomBackdrop.svelte';

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

/** How the conduits of one port family are drawn: a colour role, a surface role, a radius in metres. */
export interface ConduitSurface {
	tone: string;
	finish?: string;
	radius?: number;
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
	/** The room the products stand in. With walls, the camera stays in front of them. */
	room?: RoomLayout;
	/**
	 * Port family → what its conduits are made of (copper pipe, a white cable). Without one, a
	 * conduit is drawn in its family colour; with one, the family colour stays on its fittings.
	 */
	conduitSurfaces?: Readonly<Record<string, ConduitSurface>>;
}
</script>

<script lang="ts">
import { T, useThrelte } from '@threlte/core';
import { CameraControls, type CameraControlsRef, interactivity, TransformControls } from '@threlte/extras';
import { Box3, type DirectionalLight, type Group, type Object3D, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
	conduitPolyline,
	portUse,
	resolveComposition,
	resolvePort,
} from '#lib/product-composition/index.ts';
import { THRELTE_MAKE_DEFAULT } from '#lib/utils/threlte-workarounds.ts';
import { FALLBACK_TOKEN, SCENE_TOKENS, SELECTION_TOKEN, standardTokens, toneToken } from './composition-palette';
import { CONDUIT_TUBE } from './conduit-tube';
import ConduitMesh from './ConduitMesh.svelte';
import OccurrenceMesh from './OccurrenceMesh.svelte';
import PortMarker, { type PortEmphasis } from './PortMarker.svelte';
import RoomBackdrop from './RoomBackdrop.svelte';
import { surfaceFinish } from './surface-finish';
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
	room,
	conduitSurfaces,
}: CompositionSceneProps = $props();

interactivity();
const { invalidate, renderer, scene: world } = useThrelte();
const colors = themeColors(SCENE_TOKENS);

const resolution = $derived(resolveComposition(composition));
const tokens = $derived(standardTokens(standards));
const used = $derived(portUse(composition));
const families = $derived(new Map(standards.map((standard) => [standard.id, standard.family])));
const conduits = $derived(
	composition.couplings.flatMap((coupling) => {
		const polyline = conduitPolyline(composition, coupling.id);
		const standard = resolvePort(composition, coupling.a)?.port.standard ?? '';
		return polyline
			? [{ coupling: coupling.id, points: polyline.points, token: tokens.get(standard), family: families.get(standard) }]
			: [];
	}),
);
/** A conduit's run: its family's surface, or its family colour on the default finish. */
function conduitBody(family: string | undefined, band: string) {
	const surface = family ? conduitSurfaces?.[family] : undefined;
	return {
		color: surface ? colorOf(colors, toneToken(surface.tone)) : band,
		finish: surfaceFinish(surface?.finish),
		radius: surface?.radius ?? CONDUIT_TUBE.radius,
	};
}

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
	void room;
	void Object.values(colors);
	invalidate();
});

/**
 * Fit the camera to a box, then turn it to a three-quarter view from the front right and a
 * little above: `fitToBox` squares the camera to the box's nearest face, which shows depth
 * least of all. The padding leaves room for the turn.
 */
function frame(box: Box3, smooth: boolean) {
	if (!controls || box.isEmpty()) return;
	const center = box.getCenter(new Vector3());
	controls.setLookAt(center.x, center.y, center.z + 6, center.x, center.y, center.z, false);
	void controls.fitToBox(box, smooth, { paddingTop: 0.1, paddingBottom: 0.15, paddingLeft: 0.1, paddingRight: 0.1 });
	void controls.rotate(0.38, -0.16, smooth);
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

// ── Light ─────────────────────────────────────────────────────────────────────

// Image-based light from a generated studio room: soft fill from every side and something for
// metal and lacquer to reflect. Built once per canvas, without a download.
$effect(() => {
	const generator = new PMREMGenerator(renderer);
	const studio = new RoomEnvironment();
	const environment = generator.fromScene(studio, 0.04).texture;
	world.environment = environment;
	world.environmentIntensity = 0.45;
	invalidate();
	return () => {
		world.environment = null;
		environment.dispose();
		studio.dispose();
		generator.dispose();
	};
});

/** The key light follows the composition: aimed at its middle, its shadow frustum just covering it. */
const stage = $derived.by(() => {
	const box = new Box3();
	for (const leaf of resolution.occurrences) box.expandByPoint(new Vector3(...leaf.placement.position));
	if (box.isEmpty()) box.expandByPoint(new Vector3());
	const center = box.getCenter(new Vector3());
	const reach = box.getSize(new Vector3()).length() / 2 + 1.5;
	return { center: [center.x, center.y, center.z] as Vec3, reach };
});
let keyLight = $state<DirectionalLight>();
let keyTarget = $state<Object3D>();
$effect(() => {
	if (!keyLight) return;
	const { reach } = stage;
	const camera = keyLight.shadow.camera;
	[camera.left, camera.right, camera.top, camera.bottom] = [-reach, reach, reach, -reach];
	camera.near = 0.5;
	camera.far = 4 * reach + 10;
	camera.updateProjectionMatrix();
	invalidate();
});

// Walls stand behind the products: keep the camera in front of them and above the floor.
$effect(() => {
	if (!controls) return;
	const walled = room?.height !== undefined;
	controls.minAzimuthAngle = walled ? -1.35 : -Infinity;
	controls.maxAzimuthAngle = walled ? 1.35 : Infinity;
	controls.maxPolarAngle = room ? Math.PI / 2 - 0.04 : Math.PI;
	controls.maxDistance = 30;
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
<T.Object3D bind:ref={keyTarget} position={stage.center} />
{#if keyTarget}
	<T.DirectionalLight
		bind:ref={keyLight}
		target={keyTarget}
		position={[stage.center[0] + 3, stage.center[1] + 6, stage.center[2] + 6]}
		intensity={2.6}
		castShadow
		shadow.mapSize={[2048, 2048]}
		shadow.bias={-0.0004}
		shadow.normalBias={0.02}
	/>
{/if}
<!-- Fill from the other side, without shadows, so nothing falls to black. -->
<T.DirectionalLight position={[stage.center[0] - 5, stage.center[1] + 3, stage.center[2] + 4]} intensity={0.5} />
<T.HemisphereLight intensity={0.25} />

{#if room}
	<RoomBackdrop {room} {colors} />
{/if}

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
			band={tokenColor(conduit.token)}
			body={conduitBody(conduit.family, tokenColor(conduit.token))}
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
