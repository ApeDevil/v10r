import { type AttributeControls, coreAttributeControls } from '#lib/components/composites/attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import RatingControl from './RatingControl.svelte';

/** The core controls plus the control of the showcase's own kind, `app.rating`. */
export const showcaseControls: AttributeControls = {
	...coreAttributeControls,
	'app.rating': { label: m.showcase_dynamic_attributes_kind_rating, icon: 'i-lucide-star', component: RatingControl },
};

export { default as RatingControl } from './RatingControl.svelte';
