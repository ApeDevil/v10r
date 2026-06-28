<script lang="ts">
import { useThrelte } from '@threlte/core';
import { onDestroy } from 'svelte';
import { Color, type Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { collectPartMeshes, type PartDef, validateParts } from '$lib/config/parts';

interface Props {
	/** The loaded GLTF scene root (shared, cached by useGltf) */
	scene: Object3D;
	/** Logical part registry for this model */
	parts: PartDef[];
	/** Currently selected part id (strong highlight) */
	selectedPartId: string | null;
	/** Currently hovered part id (subtle highlight; desktop only) */
	hoveredPartId: string | null;
}

let { scene, parts, selectedPartId, hoveredPartId }: Props = $props();

const { invalidate } = useThrelte();

// Highlight looks — emissive tint (near-zero cost, mobile-safe, no postprocessing).
const HOVER = { color: new Color('#ffffff'), intensity: 0.18 };
const SELECT = { color: new Color('#ffd24a'), intensity: 0.45 };

// Original emissive per material, captured after cloning so we can restore.
type SavedEmissive = { color: Color; intensity: number };
const saved = new Map<MeshStandardMaterial, SavedEmissive>();

let initialized = $state(false);

function eachStandardMaterial(root: Object3D, fn: (mat: MeshStandardMaterial) => void) {
	root.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh) return;
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			if (mat instanceof MeshStandardMaterial) fn(mat);
		}
	});
}

function paint(partId: string | null, look: SavedEmissive) {
	if (!partId) return;
	const part = parts.find((p) => p.id === partId);
	if (!part) return;
	for (const mesh of collectPartMeshes(scene, part)) {
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			if (mat instanceof MeshStandardMaterial) {
				mat.emissive.copy(look.color);
				mat.emissiveIntensity = look.intensity;
			}
		}
	}
}

function restoreAll() {
	for (const [mat, original] of saved) {
		mat.emissive.copy(original.color);
		mat.emissiveIntensity = original.intensity;
	}
}

// --- Init: clone materials (prevent shared-ref mutation), capture emissive ---
$effect(() => {
	if (!scene || initialized) return;

	scene.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh || mesh.userData._materialsCloned) return;
		mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
		mesh.userData._materialsCloned = true;
	});

	eachStandardMaterial(scene, (mat) => {
		if (!saved.has(mat)) {
			saved.set(mat, { color: mat.emissive.clone(), intensity: mat.emissiveIntensity });
		}
	});

	if (import.meta.env.DEV) {
		const names: string[] = [];
		scene.traverse((c) => {
			if ((c as Mesh).isMesh) names.push(c.name);
		});
		console.debug('[PartHighlightLayer] meshes:', names);
		validateParts(scene, parts);
	}

	initialized = true;
});

// --- Reactive highlight: selected wins over hover ---
$effect(() => {
	if (!initialized) return;
	restoreAll();
	if (hoveredPartId && hoveredPartId !== selectedPartId) paint(hoveredPartId, HOVER);
	paint(selectedPartId, SELECT);
	invalidate(); // imperative material mutation → request a frame (on-demand mode)
});

// Restore on unmount. Do NOT dispose — useGltf caches the GLB and the customize
// route shares these materials.
onDestroy(restoreAll);
</script>
