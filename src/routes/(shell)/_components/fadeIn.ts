/**
 * Svelte action: fade-in on scroll via IntersectionObserver.
 * Respects prefers-reduced-motion.
 */
export function fadeIn(node: HTMLElement) {
	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced) {
		node.style.opacity = '1';
		return;
	}

	node.style.opacity = '0';
	node.style.transition = `opacity var(--duration-slow) ease-out`;

	const observer = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				node.style.opacity = '1';
				observer.disconnect();
			}
		},
		{ threshold: 0.1 }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		},
	};
}
