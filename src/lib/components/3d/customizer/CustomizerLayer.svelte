<script lang="ts">
	import { useThrelte } from '@threlte/core';
	import type { CustomizationConfig, CustomizationState, Accessory } from '$lib/config/customization';
	import {
		Mesh,
		MeshStandardMaterial,
		ConeGeometry,
		BoxGeometry,
		SphereGeometry,
		CylinderGeometry,
		Color,
		Vector3,
		DoubleSide,
		type Object3D,
		type Bone,
	} from 'three';
	import { onDestroy } from 'svelte';

	/** Subset of THREE.GLTFParser used for variant material resolution */
	interface GltfParser {
		getDependency(type: string, index: number): Promise<any>;
		assignFinalMaterial(mesh: Object3D): void;
	}

	interface Props {
		scene: Object3D;
		parser: GltfParser;
		config: CustomizationConfig;
		currentState: CustomizationState;
	}

	let { scene, parser, config, currentState }: Props = $props();

	const { invalidate } = useThrelte();

	// ---------------------------------------------------------------------------
	// Material cloning — prevent shared-reference mutation
	// ---------------------------------------------------------------------------

	function ensureMaterialsCloned(root: Object3D) {
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			if (mesh.userData._materialsCloned) return;
			if (Array.isArray(mesh.material)) {
				mesh.material = mesh.material.map((m) => m.clone());
			} else {
				mesh.material = mesh.material.clone();
			}
			mesh.userData._materialsCloned = true;
		});
	}

	// Store original materials for color-override reset
	const originalColors = new Map<string, Color>();

	function captureOriginalColors(root: Object3D) {
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				if (mat instanceof MeshStandardMaterial && !originalColors.has(mat.name)) {
					originalColors.set(mat.name, mat.color.clone());
				}
			}
		});
	}

	// ---------------------------------------------------------------------------
	// KHR_materials_variants — uses parser.getDependency() (Three.js r170+)
	// ---------------------------------------------------------------------------

	// Store original material per mesh for variant reset
	const originalMaterials = new Map<Mesh, MeshStandardMaterial | MeshStandardMaterial[]>();

	function captureOriginalMaterials(root: Object3D) {
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			const ext = mesh.userData?.gltfExtensions?.KHR_materials_variants;
			if (!ext?.mappings) return;
			// Store the default material (before any variant is applied)
			if (!originalMaterials.has(mesh)) {
				if (Array.isArray(mesh.material)) {
					originalMaterials.set(mesh, mesh.material.map((m) => m.clone()) as MeshStandardMaterial[]);
				} else {
					originalMaterials.set(mesh, mesh.material.clone() as MeshStandardMaterial);
				}
			}
		});
	}

	async function applyKHRVariant(root: Object3D, variantIndex: number) {
		const promises: Promise<void>[] = [];

		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			const ext = mesh.userData?.gltfExtensions?.KHR_materials_variants;
			if (!ext?.mappings) return;

			// Find the mapping that includes this variant index
			const mapping = (ext.mappings as Array<{ material: number; variants: number[] }>).find(
				(m) => m.variants.includes(variantIndex),
			);

			if (mapping) {
				// Resolve material from GLTF parser (async, cached internally)
				const promise = parser.getDependency('material', mapping.material).then((mat: MeshStandardMaterial) => {
					// Clone to prevent shared-reference mutation
					mesh.material = mat.clone();
					mesh.userData._materialsCloned = true;
					// Apply proper rendering flags (skinning, morph targets, tone mapping)
					parser.assignFinalMaterial(mesh);
				});
				promises.push(promise);
			} else {
				// No mapping for this variant — restore original
				const orig = originalMaterials.get(mesh);
				if (orig) {
					if (Array.isArray(orig)) {
						mesh.material = orig.map((m) => m.clone());
					} else {
						mesh.material = orig.clone();
					}
					mesh.userData._materialsCloned = true;
				}
			}
		});

		await Promise.all(promises);
		invalidate();
	}

	// ---------------------------------------------------------------------------
	// Color override
	// ---------------------------------------------------------------------------

	function applyColorOverride(root: Object3D, targetMaterials: string[], hex: string) {
		const color = new Color(hex);
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				if (mat instanceof MeshStandardMaterial && targetMaterials.includes(mat.name)) {
					mat.color.copy(color);
					mat.needsUpdate = true;
				}
			}
		});
		invalidate();
	}

	function resetColors(root: Object3D) {
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			const mesh = child as Mesh;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const mat of mats) {
				if (mat instanceof MeshStandardMaterial && originalColors.has(mat.name)) {
					mat.color.copy(originalColors.get(mat.name)!);
					mat.needsUpdate = true;
				}
			}
		});
		invalidate();
	}

	// ---------------------------------------------------------------------------
	// Part visibility
	// ---------------------------------------------------------------------------

	function applyPartVisibility(root: Object3D, objectNames: string[], visible: boolean) {
		for (const name of objectNames) {
			const obj = root.getObjectByName(name);
			if (obj) obj.visible = visible;
		}
		invalidate();
	}

	// ---------------------------------------------------------------------------
	// Morph targets
	// ---------------------------------------------------------------------------

	/**
	 * Find all meshes matching a name. Handles multi-primitive GLTF meshes where
	 * Three.js creates a Group "Name" with child meshes "Name_0", "Name_1", etc.
	 * Returns meshes with exact match OR prefix match (name + "_").
	 */
	function findMeshesByName(root: Object3D, name: string): Mesh[] {
		const meshes: Mesh[] = [];
		root.traverse((child) => {
			if (!('isMesh' in child && child.isMesh)) return;
			if (child.name === name || child.name.startsWith(name + '_')) {
				meshes.push(child as Mesh);
			}
		});
		return meshes;
	}

	function applyMorphTarget(root: Object3D, meshName: string, targetName: string, value: number) {
		const meshes = findMeshesByName(root, meshName);
		if (meshes.length === 0) {
			if (import.meta.env.DEV) {
				console.warn(`[CustomizerLayer] No meshes found for "${meshName}".`);
			}
			return;
		}
		let applied = false;
		for (const mesh of meshes) {
			if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
			const index = mesh.morphTargetDictionary[targetName];
			if (index !== undefined) {
				mesh.morphTargetInfluences[index] = value;
				applied = true;
			}
		}
		if (applied) {
			invalidate();
		} else if (import.meta.env.DEV) {
			console.warn(`[CustomizerLayer] Morph target "${targetName}" not found on any "${meshName}" mesh.`);
		}
	}

	// ---------------------------------------------------------------------------
	// Bone attachments
	// ---------------------------------------------------------------------------

	const GEOMETRY_FACTORIES = {
		cone: (args: number[]) => new ConeGeometry(...(args as [number, number, number])),
		box: (args: number[]) => new BoxGeometry(...(args as [number, number, number])),
		sphere: (args: number[]) => new SphereGeometry(...(args as [number, number, number])),
		cylinder: (args: number[]) => new CylinderGeometry(...(args as [number, number, number, number])),
	} as const;

	const attachedMeshes = new Map<string, { mesh: Mesh; bone: Bone }>();

	function attachAccessory(root: Object3D, boneName: string, accessory: Accessory) {
		// Remove existing if present
		detachAccessory(accessory.id);

		// Find bone
		let bone: Bone | undefined;
		root.traverse((child) => {
			if ('isBone' in child && child.isBone && child.name === boneName) {
				bone = child as Bone;
			}
		});
		if (!bone) {
			if (import.meta.env.DEV) {
				console.warn(`[CustomizerLayer] Bone "${boneName}" not found for accessory "${accessory.id}".`);
			}
			return;
		}

		const factory = GEOMETRY_FACTORIES[accessory.geometry];
		if (!factory) return;

		const geometry = factory(accessory.geometryArgs);
		const material = new MeshStandardMaterial({ color: accessory.color, side: DoubleSide });
		const mesh = new Mesh(geometry, material);

		// Compensate for the bone's world scale so accessories render at
		// the intended size regardless of the skeleton's coordinate system.
		const boneScale = bone.getWorldScale(new Vector3());
		const invScale = new Vector3(1 / boneScale.x, 1 / boneScale.y, 1 / boneScale.z);

		if (accessory.offset) {
			mesh.position.set(...accessory.offset).multiply(invScale);
		}
		if (accessory.rotation) mesh.rotation.set(...accessory.rotation);

		if (accessory.scale) {
			invScale.multiply(new Vector3(...accessory.scale));
		}
		mesh.scale.copy(invScale);

		bone.add(mesh);
		attachedMeshes.set(accessory.id, { mesh, bone });
		invalidate();
	}

	function detachAccessory(id: string) {
		const entry = attachedMeshes.get(id);
		if (!entry) return;
		entry.bone.remove(entry.mesh);
		entry.mesh.geometry.dispose();
		(entry.mesh.material as MeshStandardMaterial).dispose();
		attachedMeshes.delete(id);
		invalidate();
	}

	// ---------------------------------------------------------------------------
	// Initialize on scene load
	// ---------------------------------------------------------------------------

	let initialized = $state(false);

	$effect(() => {
		if (!scene || initialized) return;

		// Diagnostic: dump scene names so config mesh/bone names can be verified
		if (import.meta.env.DEV) {
			const meshNames: string[] = [];
			const boneNames: string[] = [];
			scene.traverse((child) => {
				if ('isMesh' in child && child.isMesh) meshNames.push(child.name);
				if ('isBone' in child && child.isBone) boneNames.push(child.name);
			});
			console.debug('[CustomizerLayer] meshes:', meshNames, 'bones:', boneNames);
		}

		ensureMaterialsCloned(scene);
		captureOriginalColors(scene);
		captureOriginalMaterials(scene);
		initialized = true;
	});

	// ---------------------------------------------------------------------------
	// React to state changes
	// ---------------------------------------------------------------------------

	// Materials
	$effect(() => {
		if (!initialized || !config.materialGroups) return;
		for (const group of config.materialGroups) {
			const selectedId = currentState.materials[group.id];
			const option = group.options.find((o) => o.id === selectedId);
			if (!option) continue;

			if (option.method === 'khr-variant' && option.variantIndex !== undefined) {
				applyKHRVariant(scene, option.variantIndex);
			} else if (option.method === 'color-override') {
				if (!option.targetMaterials?.length) {
					// "Original" — reset to original colors
					resetColors(scene);
				} else {
					applyColorOverride(scene, option.targetMaterials, option.color);
				}
			}
		}
	});

	// Part visibility
	$effect(() => {
		if (!initialized || !config.toggleableParts) return;
		for (const part of config.toggleableParts) {
			const visible = currentState.partVisibility[part.id] ?? part.defaultVisible;
			applyPartVisibility(scene, part.objectNames, visible);
		}
	});

	// Morph targets
	$effect(() => {
		if (!initialized || !scene || !config.morphTargetGroups) return;
		for (const group of config.morphTargetGroups) {
			for (const target of group.targets) {
				const key = `${group.meshName}.${target.name}`;
				const value = currentState.morphValues[key] ?? target.default;
				applyMorphTarget(scene, group.meshName, target.name, value);
			}
		}
	});

	// Accessories
	$effect(() => {
		if (!initialized || !scene || !config.attachmentPoints) return;
		for (const point of config.attachmentPoints) {
			for (const acc of point.accessories) {
				const shouldAttach = currentState.accessories[acc.id] ?? false;
				const isAttached = attachedMeshes.has(acc.id);
				if (shouldAttach && !isAttached) {
					attachAccessory(scene, point.boneName, acc);
				} else if (!shouldAttach && isAttached) {
					detachAccessory(acc.id);
				}
			}
		}
	});

	// ---------------------------------------------------------------------------
	// Cleanup
	// ---------------------------------------------------------------------------

	onDestroy(() => {
		for (const [id] of attachedMeshes) {
			detachAccessory(id);
		}
	});
</script>
