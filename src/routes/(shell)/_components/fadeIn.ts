type FadeInOptions = {
	/** Stagger delay in ms (added before the transition starts) */
	delay?: number;
	/** Translate up from this many px (0 = opacity only) */
	translate?: number;
};

/**
 * Svelte action: fade-in on scroll via IntersectionObserver.
 * Supports staggered translate entrance. Respects prefers-reduced-motion.
 */
export function fadeIn(node: HTMLElement, options: FadeInOptions = {}) {
	const { delay = 0, translate = 0 } = options;
	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (prefersReduced) {
		node.style.opacity = '1';
		return;
	}

	node.style.opacity = '0';
	if (translate) {
		node.style.transform = `translateY(${translate}px)`;
	}

	const observer = new IntersectionObserver(
		([entry]) => {
			if (entry.isIntersecting) {
				// Apply transition only on reveal so the initial state isn't animated
				const props = translate ? 'opacity, transform' : 'opacity';
				const easing = translate
					? 'cubic-bezier(0.16, 1, 0.3, 1)' // fast-settle, no bounce
					: 'ease-out';
				node.style.transition = `${props} var(--duration-slow) ${easing}`;
				node.style.transitionDelay = `${delay}ms`;
				node.style.opacity = '1';
				if (translate) {
					node.style.transform = 'translateY(0)';
				}
				observer.disconnect();
			}
		},
		{ threshold: 0.1 },
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		},
	};
}
