/**
 * Standalone Database type — extracted so non-route consumers (CLI scripts, content
 * push primitives) can depend on the type without pulling in the `$env/dynamic/private`
 * import that `./index.ts` requires.
 */

import type { drizzle } from 'drizzle-orm/neon-serverless';
import type * as schema from './schema';
import type * as relations from './schema/relations';

export type Database = ReturnType<typeof drizzle<typeof schema & typeof relations>>;
