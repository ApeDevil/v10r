/**
 * Svelte action that hydrates embed placeholders in {@html} rendered blog content.
 *
 * Scans for `[data-embed-id]` elements, matches them against EmbedDescriptor[],
 * and mounts Svelte components from the embed registry via dynamic import.
 *
 * Features:
 * - IntersectionObserver for lazy viewport-based initialization
 * - Serial initialization queue with 300ms stagger
 * - Unmount on viewport exit (context exhaustion guard)
 * - Full cleanup on action destroy
 */
import { embedRegistry } from '$lib/components/blog/embeds/registry';
import type { EmbedDescriptor } from '$lib/server/blog/types';

const DEFAULT_HEIGHT = '400px';
const STAGGER_MS = 300;
const EXIT_GRACE_MS = 2000;
const ROOT_MARGIN = '200px';

interface EmbedInstance {
	placeholder: HTMLElement;
	descriptor: EmbedDescriptor;
	component: object | null;
	phase: 'pending' | 'mounted' | 'unmounted';
	exitTimer: ReturnType<typeof setTimeout> | null;
}

export function hydrateEmbeds(
	node: HTMLElement,
	descriptors: EmbedDescriptor[] | unknown,
) {
	const embeds = Array.isArray(descriptors) ? (descriptors as EmbedDescriptor[]) : [];
	const instances = new Map<string, EmbedInstance>();
	let observer: IntersectionObserver | null = null;
	let initQueue: EmbedInstance[] = [];
	let initInProgress = false;
	let destroyed = false;

	// Svelte's mount/unmount — imported lazily to avoid SSR evaluation
	let svelteMod: { mount: Function; unmount: Function } | null = null;

	async function getSvelte() {
		if (!svelteMod) {
			svelteMod = await import('svelte');
		}
		return svelteMod;
	}

	function setup() {
		if (embeds.length === 0) return;

		// Build descriptor lookup by id
		const descriptorMap = new Map(embeds.map((d) => [d.id, d]));

		// Find all placeholder elements
		const placeholders = node.querySelectorAll<HTMLElement>('[data-embed-id]');
		if (placeholders.length === 0) return;

		for (const el of placeholders) {
			const embedId = el.getAttribute('data-embed-id');
			if (!embedId) continue;

			const descriptor = descriptorMap.get(embedId);
			if (!descriptor) continue;

			// Skip unknown embed kinds
			if (!embedRegistry[descriptor.kind]) continue;

			// Lock layout height to prevent CLS
			const height = descriptor.attrs.height
				? `${descriptor.attrs.height}px`
				: DEFAULT_HEIGHT;
			el.style.minHeight = height;

			instances.set(embedId, {
				placeholder: el,
				descriptor,
				component: null,
				phase: 'pending',
				exitTimer: null,
			});
		}

		if (instances.size === 0) return;

		// Create intersection observer
		observer = new IntersectionObserver(handleIntersect, {
			rootMargin: ROOT_MARGIN,
			threshold: 0,
		});

		for (const instance of instances.values()) {
			observer.observe(instance.placeholder);
		}
	}

	function handleIntersect(entries: IntersectionObserverEntry[]) {
		for (const entry of entries) {
			const embedId = entry.target.getAttribute('data-embed-id');
			if (!embedId) continue;

			const instance = instances.get(embedId);
			if (!instance) continue;

			if (entry.isIntersecting) {
				// Clear any pending exit timer
				if (instance.exitTimer) {
					clearTimeout(instance.exitTimer);
					instance.exitTimer = null;
				}

				if (instance.phase === 'pending') {
					initQueue.push(instance);
					processQueue();
				} else if (instance.phase === 'unmounted') {
					// Re-mount previously unmounted embed
					initQueue.push(instance);
					instance.phase = 'pending';
					processQueue();
				}
			} else {
				// Start exit grace period
				if (instance.phase === 'mounted' && !instance.exitTimer) {
					instance.exitTimer = setTimeout(() => {
						instance.exitTimer = null;
						if (!destroyed && instance.phase === 'mounted') {
							unmountInstance(instance);
						}
					}, EXIT_GRACE_MS);
				}
			}
		}
	}

	async function processQueue() {
		if (initInProgress || initQueue.length === 0 || destroyed) return;

		initInProgress = true;

		while (initQueue.length > 0 && !destroyed) {
			const instance = initQueue.shift()!;

			// Skip if already mounted or destroyed
			if (instance.phase === 'mounted') continue;

			await mountInstance(instance);

			// Stagger next mount
			if (initQueue.length > 0) {
				await new Promise((r) => setTimeout(r, STAGGER_MS));
			}
		}

		initInProgress = false;
	}

	async function mountInstance(instance: EmbedInstance) {
		if (destroyed) return;

		try {
			const [componentModule, { mount }] = await Promise.all([
				embedRegistry[instance.descriptor.kind](),
				getSvelte(),
			]);

			if (destroyed || instance.phase === 'mounted') return;

			const Component = componentModule.default as any;

			// Clear placeholder content (the "scene embed" CSS ::before text)
			instance.placeholder.removeAttribute('data-embed-kind');
			instance.placeholder.textContent = '';

			instance.component = mount(Component, {
				target: instance.placeholder,
				props: { descriptor: instance.descriptor },
			});

			instance.phase = 'mounted';
		} catch (err) {
			console.warn('[hydrate-embeds] Failed to mount embed:', instance.descriptor.id, err);
		}
	}

	async function unmountInstance(instance: EmbedInstance) {
		if (!instance.component) return;

		try {
			const { unmount } = await getSvelte();
			unmount(instance.component);
		} catch (err) {
			console.warn('[hydrate-embeds] Failed to unmount embed:', instance.descriptor.id, err);
		}

		instance.component = null;
		instance.phase = 'unmounted';

		// Restore placeholder styling
		instance.placeholder.setAttribute('data-embed-kind', instance.descriptor.kind);
	}

	function cleanup() {
		destroyed = true;
		initQueue = [];

		if (observer) {
			observer.disconnect();
			observer = null;
		}

		for (const instance of instances.values()) {
			if (instance.exitTimer) {
				clearTimeout(instance.exitTimer);
				instance.exitTimer = null;
			}
			if (instance.component) {
				// Synchronous best-effort unmount
				getSvelte().then(({ unmount }) => {
					if (instance.component) {
						try {
							unmount(instance.component);
						} catch {}
					}
				});
			}
		}

		instances.clear();
	}

	// Initialize
	setup();

	return {
		update(newDescriptors: EmbedDescriptor[] | unknown) {
			cleanup();
			destroyed = false;

			const newEmbeds = Array.isArray(newDescriptors) ? newDescriptors : [];
			// Re-assign and re-setup (embeds variable is const, so use direct setup with new data)
			embeds.length = 0;
			embeds.push(...(newEmbeds as EmbedDescriptor[]));
			setup();
		},
		destroy() {
			cleanup();
		},
	};
}
