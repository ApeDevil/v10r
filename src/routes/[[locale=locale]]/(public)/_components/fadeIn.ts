type FadeInOptions = {
	/** Stagger delay in ms (added before the transition starts) */
	delay?: number;
	/** Translate up from this many px (0 = opacity only) */
	translate?: number;
};

/**
 * Svelte action: fade-in on scroll via IntersectionObserver.
 * Supports staggered translate entrance. Respects prefers-reduced-motion.
 *
 * The node arrives already painted by SSR, so it is never hidden up front: the
 * observer's first report (delivered after layout, without forcing one) decides.
 * A node already in view at hydration stays as painted — hiding it would blink
 * visible content out and back in. Only a node still below the fold is hidden
 * to fade in later; it is off-screen, so neither change is seen, and opacity and
 * transform never move layout.
 */
export function fadeIn(node: HTMLElement, options: FadeInOptions = {}) {
	const { delay = 0, translate = 0 } = options;
	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (prefersReduced) return;

	let measured = false;

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!measured) {
				measured = true;
				if (entry.isIntersecting) {
					observer.disconnect();
					return;
				}
				node.style.opacity = '0';
				if (translate) {
					node.style.transform = `translateY(${translate}px)`;
				}
				return;
			}
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
