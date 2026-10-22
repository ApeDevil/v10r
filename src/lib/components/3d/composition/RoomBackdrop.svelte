<script lang="ts" module>
/** A window in the back wall: its centre along X, the sill height above the floor, its size. */
export interface RoomWindow {
	x: number;
	sill: number;
	width: number;
	height: number;
}

/**
 * The architecture a composition is shown in — a floor, a back wall, a corner — so wall-hung
 * products read as hung and floor-standing ones as standing. Scenery only: it is not part of
 * the document, never pickable, and has no bearing on validation. Metres, in world space.
 */
export interface RoomLayout {
	/** Floor level (y). */
	floor: number;
	/** The room's rear edge (z): the back wall's face, or where the floor ends behind. */
	back: number;
	/** The room's west and east ends (x). */
	span: readonly [number, number];
	/** How far the floor runs toward the viewer from `back`. */
	depth: number;
	/** Wall height. Absent: a floor alone, no walls. */
	height?: number;
	/** A side wall closing one end of the back wall. */
	corner?: 'west' | 'east';
	windows?: readonly RoomWindow[];
}

/** Floor tiles and plaster, by the size one texture repeat covers, in metres. */
const TILE = 0.6;
const PLASTER = 1.5;
const SKIRTING = { height: 0.08, thickness: 0.014 };
const FRAME = { width: 0.05, depth: 0.07 };
</script>

<script lang="ts">
import { T } from '@threlte/core';
import { FrontSide } from 'three';
import { ROOM_TOKENS } from './composition-palette';
import { surfaceTexture, type SurfaceTexture } from './surface-finish';
import { colorOf } from './theme-colors.svelte';

interface Props {
	room: RoomLayout;
	colors: Record<string, string>;
}

let { room, colors }: Props = $props();

const width = $derived(room.span[1] - room.span[0]);
const middle = $derived((room.span[0] + room.span[1]) / 2);
const height = $derived(room.height ?? 0);
const cornerX = $derived(room.corner === 'east' ? room.span[1] : room.span[0]);
/** The side wall faces into the room: +X at the west end, −X at the east. */
const cornerTurn = $derived(room.corner === 'east' ? -Math.PI / 2 : Math.PI / 2);

/** A repeat of a shared map for one surface; the clone shares the pixels and is freed with the room. */
function repeated(kind: SurfaceTexture, u: number, v: number) {
	const texture = surfaceTexture(kind).clone();
	texture.repeat.set(u, v);
	return texture;
}
const floorMaps = $derived({
	tile: repeated('tile', width / TILE, room.depth / TILE),
	roughness: repeated('tile-roughness', width / TILE, room.depth / TILE),
	relief: repeated('tile-relief', width / TILE, room.depth / TILE),
});
const backPlaster = $derived(repeated('plaster', width / PLASTER, Math.max(height, 1) / PLASTER));
const cornerPlaster = $derived(repeated('plaster', room.depth / PLASTER, Math.max(height, 1) / PLASTER));
$effect(() => {
	const owned = [...Object.values(floorMaps), backPlaster, cornerPlaster];
	return () => {
		for (const texture of owned) texture.dispose();
	};
});

const plaster = $derived(colorOf(colors, ROOM_TOKENS.plaster));
const trim = $derived(colorOf(colors, ROOM_TOKENS.trim));
</script>

<!-- Front faces only: orbiting behind a wall or under the floor looks through it, as into a dollhouse. -->
<T.Mesh
	position={[middle, room.floor, room.back + room.depth / 2]}
	rotation={[-Math.PI / 2, 0, 0]}
	receiveShadow
>
	<T.PlaneGeometry args={[width, room.depth]} />
	<T.MeshPhysicalMaterial
		color={colorOf(colors, ROOM_TOKENS.tile)}
		map={floorMaps.tile}
		roughness={1}
		roughnessMap={floorMaps.roughness}
		bumpMap={floorMaps.relief}
		bumpScale={1.5}
		clearcoat={0.15}
		clearcoatRoughness={0.4}
		side={FrontSide}
	/>
</T.Mesh>

{#if height > 0}
	<T.Mesh position={[middle, room.floor + height / 2, room.back]} receiveShadow>
		<T.PlaneGeometry args={[width, height]} />
		<T.MeshStandardMaterial
			color={plaster}
			roughness={0.95}
			roughnessMap={backPlaster}
			bumpMap={backPlaster}
			bumpScale={2}
			side={FrontSide}
		/>
	</T.Mesh>
	<!-- Skirting along the back wall. -->
	<T.Mesh
		position={[middle, room.floor + SKIRTING.height / 2, room.back + SKIRTING.thickness / 2]}
		castShadow
		receiveShadow
	>
		<T.BoxGeometry args={[width, SKIRTING.height, SKIRTING.thickness]} />
		<T.MeshPhysicalMaterial color={trim} roughness={0.45} clearcoat={0.3} />
	</T.Mesh>

	{#if room.corner}
		<T.Group position={[cornerX, room.floor, room.back + room.depth / 2]} rotation={[0, cornerTurn, 0]}>
			<T.Mesh position={[0, height / 2, 0]} receiveShadow>
				<T.PlaneGeometry args={[room.depth, height]} />
				<T.MeshStandardMaterial
					color={plaster}
					roughness={0.95}
					roughnessMap={cornerPlaster}
					bumpMap={cornerPlaster}
					bumpScale={2}
					side={FrontSide}
				/>
			</T.Mesh>
			<T.Mesh position={[0, SKIRTING.height / 2, SKIRTING.thickness / 2]} castShadow receiveShadow>
				<T.BoxGeometry args={[room.depth, SKIRTING.height, SKIRTING.thickness]} />
				<T.MeshPhysicalMaterial color={trim} roughness={0.45} clearcoat={0.3} />
			</T.Mesh>
		</T.Group>
	{/if}

	{#each room.windows ?? [] as opening, index (index)}
		{@const centre = room.floor + opening.sill + opening.height / 2}
		<T.Group position={[opening.x, centre, room.back]}>
			<!-- The pane: sky by day, night in the dark theme. Unlit, so it reads as light coming in. -->
			<T.Mesh position={[0, 0, 0.002]}>
				<T.PlaneGeometry args={[opening.width, opening.height]} />
				<T.MeshBasicMaterial color={colorOf(colors, ROOM_TOKENS.window)} toneMapped={false} />
			</T.Mesh>
			{#each [-1, 1] as side (side)}
				<!-- Jambs, then head and sill rails. -->
				<T.Mesh position={[(side * (opening.width + FRAME.width)) / 2, 0, FRAME.depth / 2]} castShadow receiveShadow>
					<T.BoxGeometry args={[FRAME.width, opening.height + 2 * FRAME.width, FRAME.depth]} />
					<T.MeshPhysicalMaterial color={trim} roughness={0.4} clearcoat={0.4} />
				</T.Mesh>
				<T.Mesh position={[0, (side * (opening.height + FRAME.width)) / 2, FRAME.depth / 2]} castShadow receiveShadow>
					<T.BoxGeometry args={[opening.width, FRAME.width, FRAME.depth]} />
					<T.MeshPhysicalMaterial color={trim} roughness={0.4} clearcoat={0.4} />
				</T.Mesh>
			{/each}
			<!-- Mullion and transom: a four-light casement. -->
			<T.Mesh position={[0, 0, FRAME.depth / 3]} castShadow>
				<T.BoxGeometry args={[FRAME.width * 0.7, opening.height, FRAME.depth / 2]} />
				<T.MeshPhysicalMaterial color={trim} roughness={0.4} clearcoat={0.4} />
			</T.Mesh>
			<T.Mesh position={[0, opening.height / 6, FRAME.depth / 3]} castShadow>
				<T.BoxGeometry args={[opening.width, FRAME.width * 0.7, FRAME.depth / 2]} />
				<T.MeshPhysicalMaterial color={trim} roughness={0.4} clearcoat={0.4} />
			</T.Mesh>
			<!-- The sill board stands proud of the wall. -->
			<T.Mesh position={[0, -opening.height / 2 - FRAME.width - 0.015, 0.09]} castShadow receiveShadow>
				<T.BoxGeometry args={[opening.width + 0.24, 0.03, 0.18]} />
				<T.MeshPhysicalMaterial color={trim} roughness={0.35} clearcoat={0.5} />
			</T.Mesh>
		</T.Group>
	{/each}
{/if}
