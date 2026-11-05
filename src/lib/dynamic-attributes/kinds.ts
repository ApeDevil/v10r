/**
 * Attribute kinds: what a value of one kind may be, how it reads as text, and how a value of
 * another kind converts into it. The record names a kind by id; the registry an application
 * supplies decides which ids exist. A kind is data and pure functions — never code taken from
 * a record — so a record can only ever choose among kinds the application shipped.
 *
 * Conversion has one rule for every pair of kinds, instead of a table that grows with the
 * square of the kinds: a value converts through its text. The conversion is **exact** when
 * the converted value reads back as the same text; anything else is lossy, and the operation
 * that changes a kind keeps the old value beside the new one until the user decides
 * (`operations.ts`).
 */
import type { JsonObject, JsonValue } from './json.ts';
import type { AttributeLimits } from './limits.ts';

/** Findings a value can carry without being refused: the record keeps it, the editor says so. */
export type AttributeValueFinding = 'below_min' | 'above_max' | 'not_integer' | 'unknown_option';

export interface AttributeKind {
	/** Stable id stored in every attribute of this kind. Lowercase, dot- or dash-separated. */
	readonly id: string;
	/** The config a new attribute of this kind starts with. */
	defaultConfig(): JsonObject;
	/** The config if `input` is one this kind accepts, else undefined. Returns a fresh copy. */
	parseConfig(input: JsonValue, limits: AttributeLimits): JsonObject | undefined;
	/** Whether `value` is structurally a value of this kind under `config`. */
	accepts(value: JsonValue, config: JsonObject, limits: AttributeLimits): boolean;
	/** The value a new or cleared attribute holds. */
	empty(config: JsonObject): JsonValue;
	/** The value as a person would type it. The bridge every conversion crosses. */
	text(value: JsonValue, config: JsonObject): string;
	/** A value of this kind read from text, or undefined if the text is not one. */
	fromText(text: string, config: JsonObject, limits: AttributeLimits): JsonValue | undefined;
	/** A config that lets `text` convert, when the kind needs one (a selection needs options). */
	configFromText?(text: string, limits: AttributeLimits): JsonObject;
	/** Soft findings about an accepted value. */
	check?(value: JsonValue, config: JsonObject): AttributeValueFinding[];
}

export interface AttributeKindRegistry {
	get(id: string): AttributeKind | undefined;
	/** Kind ids in the order the application listed them — the order a picker shows. */
	readonly ids: readonly string[];
}

const KIND_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function isKindId(id: string): boolean {
	return id.length <= 40 && KIND_ID.test(id);
}

/** A registry over `kinds`. Throws on a malformed or repeated id — a programming error. */
export function createAttributeKindRegistry(kinds: readonly AttributeKind[]): AttributeKindRegistry {
	const byId = new Map<string, AttributeKind>();
	for (const kind of kinds) {
		if (!isKindId(kind.id)) throw new Error(`Invalid attribute kind id "${kind.id}"`);
		if (byId.has(kind.id)) throw new Error(`Attribute kind "${kind.id}" is registered twice`);
		byId.set(kind.id, kind);
	}
	const ids = Object.freeze([...byId.keys()]);
	return { get: (id) => byId.get(id), ids };
}

/** True when `text` holds a control character other than those `allowed` (as char codes). */
export function hasControlCharacter(text: string, allowed: readonly number[] = []): boolean {
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if ((code < 0x20 || code === 0x7f) && !allowed.includes(code)) return true;
	}
	return false;
}

/** The empty config every kind without options shares. */
function noConfig(input: JsonValue): JsonObject | undefined {
	return input !== null && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0
		? {}
		: undefined;
}

const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;

export const textKind: AttributeKind = {
	id: 'text',
	defaultConfig: () => ({}),
	parseConfig: noConfig,
	accepts: (value, _config, limits) =>
		typeof value === 'string' && value.length <= limits.textLength && !hasControlCharacter(value, [TAB]),
	empty: () => '',
	text: (value) => value as string,
	fromText: (text, _config, limits) => text.replace(/[\r\n]+/g, ' ').slice(0, limits.textLength),
};

export const multilineKind: AttributeKind = {
	id: 'multiline',
	defaultConfig: () => ({}),
	parseConfig: noConfig,
	accepts: (value, _config, limits) =>
		typeof value === 'string' && value.length <= limits.multilineLength && !hasControlCharacter(value, [TAB, LF, CR]),
	empty: () => '',
	text: (value) => value as string,
	fromText: (text, _config, limits) => text.slice(0, limits.multilineLength),
};

/** A plain decimal as people write one; no hex, no `Infinity`, no thousands separators. */
const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

interface NumberConfig {
	min?: number;
	max?: number;
	integer?: boolean;
}

export const numberKind: AttributeKind = {
	id: 'number',
	defaultConfig: () => ({}),
	parseConfig(input) {
		if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
		const out: JsonObject = {};
		for (const [key, value] of Object.entries(input)) {
			if ((key === 'min' || key === 'max') && typeof value === 'number' && Number.isFinite(value)) out[key] = value;
			else if (key === 'integer' && typeof value === 'boolean') out[key] = value;
			else return undefined;
		}
		const { min, max } = out as NumberConfig;
		if (min !== undefined && max !== undefined && min > max) return undefined;
		return out;
	},
	accepts: (value) => value === null || (typeof value === 'number' && Number.isFinite(value)),
	empty: () => null,
	text: (value) => (value === null ? '' : String(value)),
	fromText(text) {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		if (!DECIMAL.test(trimmed)) return undefined;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : undefined;
	},
	check(value, config) {
		if (typeof value !== 'number') return [];
		const { min, max, integer } = config as NumberConfig;
		const findings: AttributeValueFinding[] = [];
		if (min !== undefined && value < min) findings.push('below_min');
		if (max !== undefined && value > max) findings.push('above_max');
		if (integer && !Number.isInteger(value)) findings.push('not_integer');
		return findings;
	},
};

export const booleanKind: AttributeKind = {
	id: 'boolean',
	defaultConfig: () => ({}),
	parseConfig: noConfig,
	accepts: (value) => typeof value === 'boolean',
	empty: () => false,
	text: (value) => (value ? 'true' : 'false'),
	fromText(text) {
		const word = text.trim().toLowerCase();
		if (word === 'true') return true;
		if (word === 'false') return false;
		return undefined;
	},
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date with no time and no zone: the day a person means, wherever they are. */
export function isCalendarDate(text: string): boolean {
	const match = ISO_DATE.exec(text);
	if (!match) return false;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const dateKind: AttributeKind = {
	id: 'date',
	defaultConfig: () => ({}),
	parseConfig: noConfig,
	accepts: (value) => value === null || (typeof value === 'string' && isCalendarDate(value)),
	empty: () => null,
	text: (value) => (value === null ? '' : (value as string)),
	fromText(text) {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		return isCalendarDate(trimmed) ? trimmed : undefined;
	},
};

export interface SelectOption {
	/** Stable: the value stores it, so relabelling an option keeps every choice. */
	id: string;
	label: string;
}

const OPTION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function selectOptions(config: JsonObject): SelectOption[] {
	return (config.options as unknown as SelectOption[] | undefined) ?? [];
}

export const selectKind: AttributeKind = {
	id: 'select',
	defaultConfig: () => ({ options: [] }),
	parseConfig(input, limits) {
		if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined;
		const keys = Object.keys(input);
		if (keys.length !== 1 || keys[0] !== 'options') return undefined;
		const raw = input.options;
		if (!Array.isArray(raw) || raw.length > limits.options) return undefined;
		const seen = new Set<string>();
		const options: JsonObject[] = [];
		for (const option of raw) {
			if (option === null || typeof option !== 'object' || Array.isArray(option)) return undefined;
			const { id, label, ...rest } = option;
			if (Object.keys(rest).length > 0) return undefined;
			if (typeof id !== 'string' || id.length > 40 || !OPTION_ID.test(id) || seen.has(id)) return undefined;
			if (typeof label !== 'string' || label.length > limits.labelLength || hasControlCharacter(label))
				return undefined;
			seen.add(id);
			options.push({ id, label });
		}
		return { options };
	},
	accepts: (value) => value === null || (typeof value === 'string' && value.length <= 40 && OPTION_ID.test(value)),
	empty: () => null,
	text: (value, config) => (value === null ? '' : (selectOptions(config).find((o) => o.id === value)?.label ?? '')),
	fromText(text, config) {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		return selectOptions(config).find((o) => o.label === trimmed)?.id;
	},
	configFromText(text, limits) {
		const labels = [...new Set(text.split('\n').map((line) => line.trim()))].filter(Boolean).slice(0, limits.options);
		return {
			options: labels.map((label, i) => ({ id: `option-${i + 1}`, label: label.slice(0, limits.labelLength) })),
		};
	},
	check(value, config) {
		if (value === null) return [];
		return selectOptions(config).some((o) => o.id === value) ? [] : ['unknown_option'];
	},
};

export const listKind: AttributeKind = {
	id: 'list',
	defaultConfig: () => ({}),
	parseConfig: noConfig,
	accepts: (value, _config, limits) =>
		Array.isArray(value) &&
		value.length <= limits.listItems &&
		value.every(
			(item) => typeof item === 'string' && item.length <= limits.listItemLength && !hasControlCharacter(item, [TAB]),
		),
	empty: () => [],
	text: (value) => (value as string[]).join('\n'),
	fromText: (text, _config, limits) =>
		text
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
			.slice(0, limits.listItems)
			.map((line) => line.slice(0, limits.listItemLength)),
};

/** The kinds every application gets. Order is the picker's order. */
export const CORE_ATTRIBUTE_KINDS: readonly AttributeKind[] = [
	textKind,
	multilineKind,
	numberKind,
	booleanKind,
	dateKind,
	selectKind,
	listKind,
];

export const coreAttributeKinds: AttributeKindRegistry = createAttributeKindRegistry(CORE_ATTRIBUTE_KINDS);
