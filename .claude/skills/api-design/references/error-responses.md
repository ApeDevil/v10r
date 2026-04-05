# Error Responses

Standardized error handling for REST APIs. Based on RFC 9457 (Problem Details for HTTP APIs) with practical adaptations.

## RFC 9457 Standard Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `type` | URI | Optional | Identifies the error class (e.g., `/errors/validation-failed`) |
| `title` | string | Optional | Human-readable summary of the error type |
| `status` | integer | Recommended | HTTP status code (redundant but useful for logging) |
| `detail` | string | Recommended | Human-readable explanation specific to this occurrence |
| `instance` | URI | Optional | Identifies this specific error occurrence |

### Practical Subset

Most production APIs (Stripe, GitHub) implement a subset. The practical minimum:

```typescript
{
  "error": {
    "code": "validation_failed",   // ← machine-readable (stable contract)
    "message": "Invalid email",    // ← human-readable (can change)
    "fields": [...]                // ← per-field errors (for forms)
  }
}
```

The `code` field is the API contract. Clients switch on `code`, not `message`. Changing a `code` value is a breaking change.

## Valibot Schemas

### Error Envelope

```typescript
// src/lib/server/api/schemas.ts
import * as v from 'valibot';

export const ApiFieldError = v.object({
  path: v.string(),
  message: v.string(),
});

export const ApiError = v.object({
  error: v.object({
    code: v.string(),
    message: v.string(),
    fields: v.optional(v.array(ApiFieldError)),
  }),
});

export type ApiErrorType = v.InferOutput<typeof ApiError>;
```

### Error Factory

```typescript
// src/lib/server/api/errors.ts
import { json } from '@sveltejs/kit';

interface FieldError {
  path: string;
  message: string;
}

export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: FieldError[]
) {
  return json(
    { error: { code, message, ...(fields && { fields }) } },
    { status }
  );
}

// Convenience functions
export function notFound(resource: string) {
  return apiError(404, 'not_found', `${resource} not found`);
}

export function validationError(issues: v.BaseIssue<unknown>[]) {
  return apiError(422, 'validation_failed', 'Request validation failed', 
    issues.map(i => ({
      path: i.path?.map(p => p.key).join('.') ?? '',
      message: i.message,
    }))
  );
}

export function conflict(message: string) {
  return apiError(409, 'conflict', message);
}

export function rateLimited(retryAfter: number) {
  return new Response(
    JSON.stringify({ error: { code: 'rate_limited', message: 'Too many requests' } }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
```

### Integration with validateBody

```typescript
export async function validateBody<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  request: Request,
  schema: T
): Promise<v.InferOutput<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw apiError(400, 'invalid_json', 'Request body is not valid JSON');
  }

  const result = v.safeParse(schema, body);
  if (!result.success) {
    throw validationError(result.issues);
  }
  return result.output;
}
```

## Error Code Registry

Maintain a registry of all error codes your API can return. This becomes your error contract.

```typescript
// src/lib/server/api/error-codes.ts
export const ERROR_CODES = {
  // Generic
  validation_failed: 'Request validation failed',
  not_found: 'Resource not found',
  unauthorized: 'Authentication required',
  forbidden: 'Insufficient permissions',
  conflict: 'Resource state conflict',
  rate_limited: 'Too many requests',
  internal_error: 'Internal server error',

  // Domain-specific
  idempotency_conflict: 'Idempotency key reused with different payload',
  session_expired: 'Session has expired',
  email_taken: 'Email address is already registered',
} as const;
```

## Security Considerations

**Never include in error responses:**
- Database constraint names (`unique_users_email`)
- SQL error messages (`ERROR: duplicate key value violates...`)
- Stack traces or file paths
- Internal entity IDs that differ from public IDs
- Provider API error details

**The error classifier pattern:**

```typescript
// src/lib/server/db/errors.ts
export function classifyDbError(err: unknown): { code: string; safeMessage: string; status: number } {
  if (err instanceof DatabaseError) {
    if (err.code === '23505') { // unique violation
      return { code: 'conflict', safeMessage: 'Resource already exists', status: 409 };
    }
    if (err.code === '23503') { // foreign key violation
      return { code: 'not_found', safeMessage: 'Referenced resource not found', status: 404 };
    }
  }
  return { code: 'internal_error', safeMessage: 'An unexpected error occurred', status: 500 };
}
```

## Multi-Client Error Translation

The same domain error translates differently per adapter:

| Adapter | Translation |
|---------|-------------|
| REST `+server.ts` | `return apiError(404, 'not_found', 'Item not found')` |
| Form action | `return fail(404, { form, error: 'Item not found' })` |
| AI tool `execute()` | `return { error: 'Item not found.' }` (never throw) |
| Background job | `console.error(...)` + retry or dead-letter |
