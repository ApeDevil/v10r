/**
 * Every source the check knows, in the order the coverage list shows them: trade marks,
 * companies, domains, web. Territory scoping happens in `check.ts`; this list is the
 * whole world.
 */

import type { NameSource } from '../name-source';
import { euipoSource } from './euipo';
import { gleifSource } from './gleif';
import {
	dpmaSource,
	handelsregisterSource,
	opencorporatesSource,
	tmviewSource,
	usptoSource,
	wipoSource,
} from './manual';
import { rdapSource } from './rdap';
import { webSource } from './web';

export const NAME_SOURCES: readonly NameSource[] = [
	euipoSource,
	dpmaSource,
	tmviewSource,
	wipoSource,
	usptoSource,
	gleifSource,
	handelsregisterSource,
	opencorporatesSource,
	rdapSource,
	webSource,
];
