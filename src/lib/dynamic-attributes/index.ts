export {
	ATTRIBUTE_RECORD_UPCASTERS,
	type AttributeCodecOptions,
	type AttributeRecordParse,
	type AttributeRecordProblem,
	type AttributeRecordProblemCode,
	type AttributeRecordUpcaster,
	isLabel,
	parseAttributeRecord,
	parseAttributeRecordText,
	serializeAttributeRecord,
} from './codec.ts';
export {
	type AttributeDiagnostic,
	type AttributeDiagnosticCode,
	checkAttributeRecord,
	normalizedLabel,
} from './diagnostics.ts';
export { canonicalJson, copyBoundedJson, type JsonObject, type JsonValue, jsonEqual, utf8Length } from './json.ts';
export {
	type AttributeKind,
	type AttributeKindRegistry,
	type AttributeValueFinding,
	booleanKind,
	CORE_ATTRIBUTE_KINDS,
	coreAttributeKinds,
	createAttributeKindRegistry,
	dateKind,
	hasControlCharacter,
	isCalendarDate,
	listKind,
	multilineKind,
	numberKind,
	type SelectOption,
	selectKind,
	textKind,
} from './kinds.ts';
export { type AttributeLimits, DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
export {
	type AttributeMerge,
	type AttributeMergeConflict,
	type MergeConflictPart,
	mergeAttributeRecords,
} from './merge.ts';
export {
	type AttributeEngine,
	type AttributeOperation,
	type AttributeRefusalCode,
	addAttribute,
	changeAttributeKind,
	configureAttribute,
	convertAttributeValue,
	createAttributeEngine,
	discardPreviousValue,
	type KindConversion,
	moveAttribute,
	type NewAttribute,
	relabelAttribute,
	removeAttribute,
	restoreAttribute,
	restorePreviousValue,
	setAttributeValue,
} from './operations.ts';
export { attributeRecordToText } from './projection.ts';
export {
	ATTRIBUTE_RECORD_FORMAT,
	type Attribute,
	type AttributeRecord,
	createAttributeId,
	emptyAttributeRecord,
	isAttributeId,
	type PreviousAttributeValue,
	type RemovedAttribute,
} from './record.ts';
export {
	AttributeRecordLoadError,
	type AttributeRecordSave,
	type AttributeRecordSnapshot,
	type AttributeRecordStore,
	createKeyValueRecordStore,
	type KeyValueStorage,
	memoryStorage,
} from './stores.ts';
