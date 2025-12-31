---
name: valibot-superforms
description: Form validation for Velociraptor using Valibot v1 + Superforms. Use when creating forms, validation schemas, handling errors, or implementing accessible form patterns. Includes Svelte 5 patterns, progressive enhancement, file uploads, and WCAG accessibility. Essential for any form implementation.
---

# Valibot + Superforms

Type-safe form validation with tree-shakeable schemas. Valibot v1 + Superforms v2.

## Contents

- [Quick Start](#quick-start) - Schema, server, client setup
- [Valibot Schemas](#valibot-schemas) - Types, pipe(), objects, arrays
- [Superforms Stores](#superforms-stores) - form, errors, submitting, etc.
- [Error Display](#error-display) - Field errors, summary, server-side
- [Loading States](#loading-states) - submitting vs delayed
- [Configuration](#configuration) - Validation, error handling, reset
- [Events](#events) - onSubmit, onUpdate, onError
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Detailed guides

| Concept | Purpose |
|---------|---------|
| Valibot schemas | Define validation rules |
| `pipe()` | Chain validations and transformations |
| Superforms | SvelteKit form state management |
| `valibotClient` | Client-side validation adapter |
| Progressive enhancement | Works without JS |

## Quick Start

### Schema Definition

```typescript
// src/lib/schemas/auth.ts
import * as v from 'valibot';

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email')),
  password: v.pipe(v.string(), v.minLength(8, 'Min 8 characters'))
});

export type LoginInput = v.InferInput<typeof loginSchema>;
export type LoginOutput = v.InferOutput<typeof loginSchema>;
```

### Server Setup

```typescript
// +page.server.ts
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth';

export const load = async () => {
  const form = await superValidate(valibot(loginSchema));
  return { form };
};

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // form.data is typed and validated
    await authenticate(form.data.email, form.data.password);

    return message(form, 'Login successful!');
  }
};
```

### Client Setup (Svelte 5)

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { loginSchema } from '$lib/schemas/auth';

  let { data } = $props();

  const { form, errors, constraints, enhance, submitting } = superForm(data.form, {
    validators: valibotClient(loginSchema)
  });
</script>

<form method="POST" use:enhance>
  <label for="email">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    bind:value={$form.email}
    aria-invalid={$errors.email ? 'true' : undefined}
    {...$constraints.email}
  />
  {#if $errors.email}
    <span class="error">{$errors.email}</span>
  {/if}

  <label for="password">Password</label>
  <input
    id="password"
    name="password"
    type="password"
    bind:value={$form.password}
    aria-invalid={$errors.password ? 'true' : undefined}
    {...$constraints.password}
  />
  {#if $errors.password}
    <span class="error">{$errors.password}</span>
  {/if}

  <button disabled={$submitting}>
    {$submitting ? 'Logging in...' : 'Login'}
  </button>
</form>
```

## Valibot Schemas

### Basic Types

```typescript
import * as v from 'valibot';

// Primitives
const str = v.string();
const num = v.number();
const bool = v.boolean();
const date = v.date();

// With validation
const email = v.pipe(v.string(), v.email());
const age = v.pipe(v.number(), v.minValue(18));
const url = v.pipe(v.string(), v.url());
```

### The `pipe()` Function

Chain validations and transformations sequentially:

```typescript
const EmailSchema = v.pipe(
  v.string(),                    // 1. Must be string
  v.trim(),                      // 2. Trim whitespace
  v.toLowerCase(),               // 3. Convert to lowercase
  v.email('Invalid email'),      // 4. Validate format
  v.maxLength(100, 'Too long')   // 5. Check length
);

const PasswordSchema = v.pipe(
  v.string(),
  v.minLength(8, 'Min 8 characters'),
  v.regex(/[A-Z]/, 'Need uppercase'),
  v.regex(/[0-9]/, 'Need number')
);
```

### Objects and Arrays

```typescript
const UserSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2)),
  email: v.pipe(v.string(), v.email()),
  tags: v.array(v.string()),
  address: v.object({
    street: v.string(),
    city: v.string()
  })
});

// Optional fields
const ProfileSchema = v.object({
  bio: v.optional(v.string()),           // string | undefined
  website: v.nullable(v.string()),       // string | null
  nickname: v.optional(v.string(), '')   // string (with default)
});
```

### Transformations

```typescript
// String → Number
const PixelsSchema = v.pipe(
  v.string(),
  v.regex(/^\d+px$/),
  v.transform((s) => parseInt(s))
);

// Array transformations
const ProcessedTags = v.pipe(
  v.array(v.string()),
  v.filterItems((t) => t.length > 0),
  v.mapItems((t) => t.toLowerCase())
);
```

### Custom Validation

```typescript
const AgeSchema = v.pipe(
  v.number(),
  v.check((age) => age >= 18, 'Must be 18+')
);

// Async validation (single field)
const UniqueEmailSchema = v.pipeAsync(
  v.string(),
  v.email(),
  v.checkAsync(
    async (email) => !(await emailExists(email)),
    'Email already registered'
  )
);
```

### Async Schemas (objectAsync)

When ANY field requires async validation, use `objectAsync`:

```typescript
import * as v from 'valibot';

// Async check function
async function isUsernameAvailable(username: string): Promise<boolean> {
  const response = await fetch(`/api/check-username?u=${username}`);
  const { available } = await response.json();
  return available;
}

// Use objectAsync when ANY field has async validation
export const registerSchema = v.objectAsync({
  // Async field uses pipeAsync + checkAsync
  username: v.pipeAsync(
    v.string(),
    v.minLength(3, 'At least 3 characters'),
    v.checkAsync(isUsernameAvailable, 'Username already taken')
  ),
  // Sync fields can still use regular pipe() inside objectAsync
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
});

export type RegisterInput = v.InferInput<typeof registerSchema>;
```

**Key rules:**
- Use `objectAsync` if ANY field requires async validation
- Use `pipeAsync` + `checkAsync` for the async field
- Sync fields can use regular `pipe()` inside `objectAsync`
- Increase `delayMs: 500` to reduce server requests

## Superforms Stores

```typescript
const {
  form,        // Form data ($form.email, $form.password)
  errors,      // Validation errors ($errors.email)
  constraints, // HTML attributes ($constraints.email)
  message,     // Status message ($message)
  submitting,  // Boolean: form submitting
  delayed,     // Boolean: true after 500ms
  timeout,     // Boolean: true after 8s
  tainted,     // Which fields changed
  allErrors,   // Array of all errors
  enhance      // Progressive enhancement action
} = superForm(data.form, options);
```

## Error Display

### Field Errors

```svelte
<input
  name="email"
  bind:value={$form.email}
  aria-invalid={$errors.email ? 'true' : undefined}
  aria-describedby={$errors.email ? 'email-error' : undefined}
/>
{#if $errors.email}
  <span id="email-error" class="error" aria-live="polite">
    {$errors.email}
  </span>
{/if}
```

### Error Summary (Accessibility)

```svelte
{#if $allErrors.length > 0}
  <div role="alert" class="error-summary">
    <h2>Please fix {$allErrors.length} error(s):</h2>
    <ul>
      {#each $allErrors as error}
        <li><a href="#{error.path}">{error.messages[0]}</a></li>
      {/each}
    </ul>
  </div>
{/if}
```

### Server-Side Errors

```typescript
import { setError } from 'sveltekit-superforms';

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));

    if (await emailExists(form.data.email)) {
      return setError(form, 'email', 'Email already registered');
    }

    // Nested path
    return setError(form, 'address.city', 'Invalid city');
  }
};
```

## Loading States

```svelte
<script lang="ts">
  const { form, enhance, submitting, delayed } = superForm(data.form, {
    delayMs: 500,    // When $delayed becomes true
    timeoutMs: 8000  // When $timeout becomes true
  });
</script>

<button disabled={$submitting}>
  {#if $delayed}
    <Spinner /> Submitting...
  {:else}
    Submit
  {/if}
</button>
```

**UX Rule:** Use `$delayed` not `$submitting` for spinners. Operations <500ms don't need visual feedback.

## Configuration

```typescript
const { form, enhance } = superForm(data.form, {
  // Client-side validation
  validators: valibotClient(schema),

  // Validation timing
  validationMethod: 'auto',  // 'oninput' | 'onblur' | 'submit-only'

  // Error handling
  autoFocusOnError: 'detect',
  scrollToError: 'smooth',
  errorSelector: '[aria-invalid="true"]',

  // Reset behavior
  resetForm: false,
  clearOnSubmit: 'errors-and-message',

  // Multiple submits
  multipleSubmits: 'prevent',

  // Events
  onSubmit: ({ formData, cancel }) => {},
  onResult: ({ result }) => {},
  onUpdate: ({ form }) => {},
  onError: ({ result }) => {}
});
```

## Events

```typescript
const { form, enhance } = superForm(data.form, {
  onSubmit: ({ formData, cancel }) => {
    // Before submission
    if (!confirm('Submit?')) cancel();
  },

  onUpdate: ({ form }) => {
    // After form state updates - best for toasts
    if (form.message) {
      toast.success(form.message);
    }
  },

  onError: ({ result, message }) => {
    // Handle exceptions
    toast.error('Something went wrong');
  }
});
```

## Anti-Patterns

**Don't use SvelteKit's fail():**
```typescript
// WRONG - loses form data
import { fail } from '@sveltejs/kit';
return fail(400, { form });

// RIGHT - use Superforms fail()
import { fail } from 'sveltekit-superforms';
return fail(400, { form });
```

**Don't skip use:enhance:**
```svelte
<!-- WRONG - no client validation, no events, no timers -->
<form method="POST">

<!-- RIGHT -->
<form method="POST" use:enhance>
```

**Don't validate on every keystroke:**
```typescript
// WRONG - frustrating UX
validationMethod: 'oninput'

// RIGHT - validate on blur for most fields
validationMethod: 'auto'
```

## References

- **references/valibot-api.md** - Complete Valibot v1 API reference
- **references/superforms-config.md** - All configuration options
- **references/accessibility.md** - WCAG form patterns
- **references/nested-data.md** - Objects, arrays, file uploads
- **references/patterns.md** - Common form patterns
