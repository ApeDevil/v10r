<script lang="ts">
import { useThrelte } from '@threlte/core';
import { onDestroy } from 'svelte';
import {
	BackSide,
	type BufferGeometry,
	Color,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	type Object3D,
} from 'three';
import { collectPartMeshes, type PartDef, validateParts } from '$lib/config/parts';
import { resolveCssColor } from './css-color';

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

// Highlight looks — cheap, mobile-safe cues (no postprocessing):
// hover = subtle emissive tint; selected = theme-accent inverted-hull outline +
// dimming every other part. The selected part gets NO emissive: these materials
// are dark, so even a faint tint dominates their luminance and tone mapping
// washes the true colour into grey — and a part explorer should show the real material.
const HOVER = { color: new Color('#ffffff'), intensity: 0.18 };
/** Outline follows the theme's accent so it contrasts with --color-bg in BOTH
 * modes and every palette scheme (a fixed gold washed out on light backgrounds). */
const OUTLINE_TOKEN = 'color-primary';
const OUTLINE_FALLBACK = '#ffd24a';
/** Hull offset in world units (sofa is ~2.2m wide → ~7mm outline shell) */
const OUTLINE_OFFSET = 0.007;
const DIM_OPACITY = 0.18;

// Original material state, captured after cloning so we can restore.
type SavedMaterialState = { color: Color; intensity: number; opacity: number; transparent: boolean };
const saved = new Map<MeshStandardMaterial, SavedMaterialState>();

// Inverted-hull outline: shared material + per-geometry hull cache + live outline meshes.
// toneMapped: false → the on-screen color matches the CSS token exactly.
const outlineMaterial = new MeshBasicMaterial({ color: OUTLINE_FALLBACK, side: BackSide, toneMapped: false });
const hullCache = new Map<BufferGeometry, BufferGeometry>();
let outlineMeshes: Mesh[] = [];

let initialized = $state(false);
let outlineColor = $state(OUTLINE_FALLBACK);

// Track the accent token live: `.dark` (mode) and `data-palette` (color scheme)
// both land on <html>, so one attribute observer covers every theme change.
$effect(() => {
	outlineColor = resolveCssColor(OUTLINE_TOKEN, OUTLINE_FALLBACK);
	const themeObserver = new MutationObserver(() => {
		outlineColor = resolveCssColor(OUTLINE_TOKEN, OUTLINE_FALLBACK);
	});
	themeObserver.observe(document.documentElement, { attributeFilter: ['class', 'data-palette'] });
	return () => themeObserver.disconnect();
});

$effect(() => {
	outlineMaterial.color.set(outlineColor);
	invalidate();
});

function eachStandardMaterial(root: Object3D, fn: (mat: MeshStandardMaterial) => void) {
	root.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh || mesh.userData._isOutline) return;
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			if (mat instanceof MeshStandardMaterial) fn(mat);
		}
	});
}

function paint(partId: string | null, look: { color: Color; intensity: number }) {
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

/** Fade every mesh OUTSIDE the selected part so the selection pops. */
function dimOthers(selectedMeshes: Set<Mesh>) {
	scene.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh || mesh.userData._isOutline || selectedMeshes.has(mesh)) return;
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			if (mat instanceof MeshStandardMaterial) {
				if (!mat.transparent) {
					// Toggling `transparent` swaps the shader's OPAQUE define (which pins
					// alpha to 1.0) — without needsUpdate the cached program ignores opacity.
					mat.transparent = true;
					mat.needsUpdate = true;
				}
				mat.opacity = DIM_OPACITY;
			}
		}
	});
}

/** Expand a geometry along its vertex normals — the inverted-hull shell. */
function buildHull(geometry: BufferGeometry): BufferGeometry {
	const cached = hullCache.get(geometry);
	if (cached) return cached;
	const hull = geometry.clone();
	const pos = hull.attributes.position;
	const norm = hull.attributes.normal;
	if (norm && pos.count === norm.count) {
		for (let i = 0; i < pos.count; i++) {
			pos.setXYZ(
				i,
				pos.getX(i) + norm.getX(i) * OUTLINE_OFFSET,
				pos.getY(i) + norm.getY(i) * OUTLINE_OFFSET,
				pos.getZ(i) + norm.getZ(i) * OUTLINE_OFFSET,
			);
		}
		pos.needsUpdate = true;
	}
	hullCache.set(geometry, hull);
	return hull;
}

/** Attach back-face hull shells to the selected meshes (crisp outline, no postprocessing). */
function addOutlines(selectedMeshes: Set<Mesh>) {
	for (const mesh of selectedMeshes) {
		const outline = new Mesh(buildHull(mesh.geometry), outlineMaterial);
		outline.userData._isOutline = true;
		outline.raycast = () => {}; // never a pick target — clicks pass through to the real mesh
		mesh.add(outline);
		outlineMeshes.push(outline);
	}
}

function removeOutlines() {
	for (const outline of outlineMeshes) {
		outline.parent?.remove(outline);
	}
	outlineMeshes = [];
}

function restoreAll() {
	removeOutlines();
	for (const [mat, original] of saved) {
		mat.emissive.copy(original.color);
		mat.emissiveIntensity = original.intensity;
		mat.opacity = original.opacity;
		if (mat.transparent !== original.transparent) {
			mat.transparent = original.transparent;
			mat.needsUpdate = true; // OPAQUE define must be re-derived (see dimOthers)
		}
	}
}

// --- Init: clone materials (prevent shared-ref mutation), capture originals ---
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
			saved.set(mat, {
				color: mat.emissive.clone(),
				intensity: mat.emissiveIntensity,
				opacity: mat.opacity,
				transparent: mat.transparent,
			});
		}
	});

	if (import.meta.env.DEV) {
		const names: string[] = [];
		scene.traverse((c) => {
			if ((c as Mesh).isMesh) names.push(c.name);
		});
		console.debug(`[PartHighlightLayer] init scene=${scene.uuid.slice(0, 8)} meshes: ${names.join(',')}`);
		validateParts(scene, parts);
	}

	initialized = true;
});

// --- Reactive highlight: selected wins over hover ---
$effect(() => {
	if (!initialized) return;
	restoreAll();
	if (hoveredPartId && hoveredPartId !== selectedPartId) paint(hoveredPartId, HOVER);
	if (selectedPartId) {
		const part = parts.find((p) => p.id === selectedPartId);
		if (part) {
			const selectedMeshes = new Set(collectPartMeshes(scene, part));
			dimOthers(selectedMeshes);
			addOutlines(selectedMeshes);
		}
	}
	invalidate(); // imperative material mutation → request a frame (on-demand mode)
});

// Restore on unmount and free outline resources. Do NOT dispose the model's own
// materials — useGltf caches the GLB and the customize route shares them.
onDestroy(() => {
	restoreAll();
	for (const hull of hullCache.values()) hull.dispose();
	hullCache.clear();
	outlineMaterial.dispose();
});
</script>
