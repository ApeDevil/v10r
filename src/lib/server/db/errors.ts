import { error } from '@sveltejs/kit';

export const PG_ERROR = {
	UNIQUE_VIOLATION: '23505',
	FOREIGN_KEY_VIOLATION: '23503',
	NOT_NULL_VIOLATION: '23502',
	UNDEFINED_TABLE: '42P01',
} as const;

export function handleDbError(err: unknown): never {
	if (err instanceof Error && 'code' in err) {
		const pgError = err as Error & { code: string };

		switch (pgError.code) {
			case PG_ERROR.UNIQUE_VIOLATION:
				error(409, 'A record with this value already exists.');
			case PG_ERROR.FOREIGN_KEY_VIOLATION:
				error(400, 'Referenced record does not exist.');
			case PG_ERROR.UNDEFINED_TABLE:
				error(503, 'Database tables not initialized. Run migrations first.');
		}
	}

	console.error('[db]', err);
	error(500, 'Database error.');
}
