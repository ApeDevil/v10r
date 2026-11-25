/**
 * Reading web_core's resolved props. A dynamic prop arrives as a `ResolvedBinding` (`value`),
 * or a `WritableBinding` (`value` + `set`) when it is bound to a data model path; a child
 * reference arrives as a `ComponentNode`; an action as a function. Everything the model wrote
 * is reduced here to plain text, numbers and lists before a component sees it — there is no
 * path from a prop to markup.
 */
import { type ComponentNode, isComponentNode, isWritable, ResolvedBinding } from '@a2ui/web_core';

const unwrap = (value: unknown): unknown => (value instanceof ResolvedBinding ? value.value : value);

/** A prop as display text. Objects never stringify into the page. */
export function textOf(value: unknown): string {
	const plain = unwrap(value);
	if (typeof plain === 'string') return plain;
	if (typeof plain === 'number' && Number.isFinite(plain)) return String(plain);
	return '';
}

export function numberOf(value: unknown, fallback: number): number {
	const plain = unwrap(value);
	const n = typeof plain === 'number' ? plain : typeof plain === 'string' ? Number(plain) : Number.NaN;
	return Number.isFinite(n) ? n : fallback;
}

export function booleanOf(value: unknown): boolean {
	return unwrap(value) === true;
}

export function stringListOf(value: unknown): string[] {
	const plain = unwrap(value);
	return Array.isArray(plain) ? plain.filter((item): item is string => typeof item === 'string') : [];
}

/** The setter of a bound prop, or a no-op for a literal (the field then edits nothing). */
export function setterOf<T>(value: unknown): (next: T) => void {
	return value instanceof ResolvedBinding && isWritable(value) ? (next: T) => value.set(next as never) : () => {};
}

export function childOf(value: unknown): ComponentNode | undefined {
	return isComponentNode(value) ? value : undefined;
}

export function childrenOf(value: unknown): ComponentNode[] {
	return Array.isArray(value) ? value.filter(isComponentNode) : [];
}

export interface ChoiceOption {
	value: string;
	label: string;
}

export function optionsOf(value: unknown): ChoiceOption[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((option) => {
		if (typeof option !== 'object' || option === null) return [];
		const { value: optionValue, label } = option as Record<string, unknown>;
		const stable = textOf(optionValue);
		return stable ? [{ value: stable, label: textOf(label) || stable }] : [];
	});
}

export function tableRowsOf(value: unknown): string[][] {
	return Array.isArray(value) ? value.map((row) => (Array.isArray(row) ? row.map(textOf) : [])) : [];
}

export interface ChartSeriesProps {
	name: string;
	values: number[];
}

/**
 * A Chart's series as numbers. The policy already refused non-finite or negative values and
 * a series of the wrong length; this read keeps a malformed one from reaching the SVG anyway.
 */
export function chartSeriesOf(value: unknown, labelCount: number): ChartSeriesProps[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry, index) => {
		if (typeof entry !== 'object' || entry === null) return [];
		const { name, values } = entry as Record<string, unknown>;
		if (!Array.isArray(values)) return [];
		const numbers = values.slice(0, labelCount).map((v) => Math.max(0, numberOf(v, 0)));
		return [{ name: textOf(name) || String(index + 1), values: numbers }];
	});
}

export interface FlowNodeProps {
	label: string;
	kind: string;
	note: string;
}

/** An ArchitectureFlow's nodes as plain text; a node without a label is dropped. */
export function flowNodesOf(value: unknown): FlowNodeProps[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (typeof entry !== 'object' || entry === null) return [];
		const { label, kind, note } = entry as Record<string, unknown>;
		const text = textOf(label);
		return text ? [{ label: text, kind: textOf(kind), note: textOf(note) }] : [];
	});
}

/** A Button's resolved action: a function that dispatches the event through the surface. */
export function actionOf(value: unknown): (() => void) | undefined {
	return typeof value === 'function' ? () => void (value as () => Promise<void>)() : undefined;
}
