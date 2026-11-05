/**
 * The rendering side of the kind registry: for each kind id, the control that edits a value
 * of that kind, the word a picker shows and its icon. It is an allowlist — a record names a
 * kind, the application decides which component that means, and a kind with no control is
 * shown read-only. A record can never name a component, a module or a script.
 *
 * Heavier controls can be lazy (`load`): the editor imports one the first time a record shows
 * an attribute of that kind, so a picker that lists a chart kind does not ship the chart.
 */
import type { Component } from 'svelte';
import type {
	Attribute,
	AttributeKind,
	AttributeLimits,
	JsonObject,
	JsonValue,
} from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import BooleanControl from './controls/BooleanControl.svelte';
import DateControl from './controls/DateControl.svelte';
import ListControl from './controls/ListControl.svelte';
import MultilineControl from './controls/MultilineControl.svelte';
import NumberControl from './controls/NumberControl.svelte';
import SelectControl from './controls/SelectControl.svelte';
import TextControl from './controls/TextControl.svelte';

export interface AttributeControlProps {
	attribute: Attribute;
	kind: AttributeKind;
	limits: AttributeLimits;
	/** The id of the focusable element, so the row's label can point at it. */
	inputId: string;
	/** The id of the element naming this attribute (its label field). */
	labelledBy: string;
	disabled?: boolean;
	commit: (value: JsonValue) => void;
	configure: (config: JsonObject) => void;
}

export type AttributeControlComponent = Component<AttributeControlProps>;

export interface AttributeControl {
	label: () => string;
	icon: string;
	component?: AttributeControlComponent;
	load?: () => Promise<{ default: AttributeControlComponent }>;
}

export type AttributeControls = Readonly<Record<string, AttributeControl>>;

export const coreAttributeControls: AttributeControls = {
	text: { label: m.attributes_kind_text, icon: 'i-lucide-type', component: TextControl },
	multiline: { label: m.attributes_kind_multiline, icon: 'i-lucide-align-left', component: MultilineControl },
	number: { label: m.attributes_kind_number, icon: 'i-lucide-hash', component: NumberControl },
	boolean: { label: m.attributes_kind_boolean, icon: 'i-lucide-toggle-left', component: BooleanControl },
	date: { label: m.attributes_kind_date, icon: 'i-lucide-calendar', component: DateControl },
	select: { label: m.attributes_kind_select, icon: 'i-lucide-list-checks', component: SelectControl },
	list: { label: m.attributes_kind_list, icon: 'i-lucide-list', component: ListControl },
};
