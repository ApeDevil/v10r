# Forms Architecture

Type-safe forms with real-time validation using Superforms and Valibot.

> Schema definition, `superValidate`, `superForm`, the Valibot API, and the Valibot-vs-Zod rationale live in the **`valibot-superforms`** skill. This doc covers only v10r's decisions: the hybrid Better-Auth-vs-Superforms split, file locations, project gotchas, and the accessibility patterns this project mandates.

---

## Strategy

**Hybrid Approach:** Superforms + Valibot for most forms, Better Auth client for authentication.

| Component | Choice | Why |
|-----------|--------|-----|
| Form library | Superforms v2 | SvelteKit-native, progressive enhancement |
| Validation | Valibot | Smaller than Zod, tree-shakeable, fast |
| Enhancement | `use:enhance` | No full-page reloads |
| Feedback | Inline + Toast | Context-dependent error display |

### Hybrid Approach: When to Use What

| Form Type | Use | Why |
|-----------|-----|-----|
| Email entry (login) | **Better Auth client** | Built-in rate limiting, magic link + OTP |
| OTP verification | **Better Auth client** | Token validation, expiry handling |
| OAuth flows | **Better Auth client** | Redirect handling built-in |
| Profile updates | **Superforms + Valibot** | Not auth-critical, benefits from real-time validation |
| Settings / preferences | **Superforms + Valibot** | Standard CRUD, good UX with debounced validation |
| Contact / feedback forms | **Superforms + Valibot** | Server actions, email integration |
| CRUD operations | **Superforms + Valibot** | Data mutations with optimistic UI |

**Rationale:** Better Auth's client methods (`signIn.magicLink`, `signIn.otp`) handle security concerns that Superforms would need to replicate. Using Superforms for auth would mean re-implementing rate limiting, manual CSRF handling, and potential security gaps.

See [auth.md](./auth.md#authentication-flows) for Better Auth form implementations.

---

## Schema Location Strategy

Schema definition is skill territory; **where** schemas live in v10r is not:

| Schema Type | Location | Example |
|-------------|----------|---------|
| Route-specific | Top of `+page.server.ts` | Login form |
| Shared/reused | `$lib/schemas/*.ts` | User profile |
| Complex nested | `$lib/schemas/*.ts` | Address, wizard steps |

Export `v.InferInput<typeof schema>` types alongside each schema for reuse.

---

## Server + Client Wiring

The standard loop: `superValidate(valibot(schema))` in `load`, `superValidate(request, valibot(schema))` in the action (return `fail(400, { form })` when invalid), and `superForm(data.form, { validators: valibotClient(schema) })` on the client. The skill covers the generic shape — below are the v10r conventions layered on top.

### Validation Timing

**Default: `'auto'` (recommended)** — the research-backed "reward early, validate late" pattern. Validates on **blur** for pristine fields, and on **input** only after errors appear. Don't specify `validationMethod` unless you need to override it.

| Question | Answer | Use |
|----------|--------|-----|
| Need real-time feedback? (password strength, live char count) | Yes | `'oninput'` |
| Does validation require a server call? (username availability) | Yes | `'oninput'` + `delayMs: 500` |
| Is the form complex with expensive validation? | Yes | `'onblur'` |
| Standard form fields? | Yes | `'auto'` (default) |

### Debounce Timing Guidelines

Research shows **100-300ms** feels instant; **>300ms** feels sluggish.

| Validation Type | Recommended Delay | Rationale |
|-----------------|-------------------|-----------|
| Client-side only | **150ms** | Fast feedback, no API cost |
| Mixed client/server | **300ms** | Balance responsiveness and efficiency |
| Async server checks | **500ms** | Reduce API calls, wait for typing pause |

---

## Error Display Patterns

Three surfaces: inline field errors, a form-level `$message`, and toast notifications.

### When to Use Each

| Context | Error Display |
|---------|---------------|
| Field validation | Inline under field |
| Auth errors (invalid code, expired link) | Form-level message |
| Server errors (500) | Toast notification |
| Success feedback | Toast notification |
| Multi-step wizard | Summary at step top |

### Error Priority Hierarchy

When multiple error types occur simultaneously, follow this priority to avoid overwhelming users:

| Priority | Error Type | Display Method | Suppress Others? |
|----------|------------|----------------|------------------|
| 1 (Highest) | Network failure | Toast (error) | Yes — hide form errors |
| 2 | Server error (500) | Form-level message | Yes — skip field errors |
| 3 | Rate limit exceeded | Form-level message | Yes — skip field errors |
| 4 | Auth failure | Form-level message | No |
| 5 | Multiple field errors | Inline + focus first | No toast |
| 6 (Lowest) | Single field error | Inline only | No |

**Implementation** — branch in `onError`/`onResult`, focusing the first invalid field on multi-error failures:

```typescript
const { form, errors, enhance, message } = superForm(data.form, {
  validators: valibotClient(schema),

  onError({ result }) {
    // Priority 1: network/connection errors — suppress field errors
    if (result.error?.message?.includes('fetch')) {
      toast.error('Connection lost. Please check your network.');
      return;
    }
    // Priority 2-3: server errors flow through form-level $message
  },

  onResult({ result }) {
    if (result.type === 'failure') {
      // Priority 5: focus first invalid field
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError instanceof HTMLElement) firstError.focus();
    }
    if (result.type === 'success') {
      toast.success('Changes saved!');
    }
  },
});
```

---

## Data Invalidation After Form Actions

Form actions using `use:enhance` trigger `invalidateAll()` after a successful submission, re-running all load functions on the current page.

| Pattern | Use Case | Example |
|---------|----------|---------|
| `invalidateAll: true` (default) | User login/logout | Update global user state |
| `invalidate('/api/items')` | Item CRUD on list page | Refresh items list only |
| `invalidateAll: false` + local state | Real-time preview | Update component state without refetch |
| `goto()` + automatic invalidation | Create → Detail page | Navigate + fresh data |
| Redirect from server | Create → List page | `redirect(303, '/items')` |

### Optimistic Updates Pattern

Set `invalidateAll: false`, mutate local `$state` in `onSubmit`, reconcile with the server item in `onResult`, and roll back in `onError`:

```typescript
let items = $state(data.items);

const { form, enhance } = superForm(data.form, {
  invalidateAll: false,

  onSubmit() {
    const tempId = `temp_${Date.now()}`;
    items = [...items, { id: tempId, ...formData }];
  },
  onResult({ result }) {
    if (result.type === 'success' && result.data?.item) {
      items = items.map(i => i.id.startsWith('temp_') ? result.data.item : i);
    }
  },
  onError() {
    items = items.filter(i => !i.id.startsWith('temp_'));
    toast.error('Failed to create item');
  },
});
```

**Prefer a server-side `redirect(303, ...)`** when navigating after a mutation (automatic invalidation). Use client-side `invalidate()` when staying on the page.

---

## Form Patterns

### Edit Form (Loading Existing Data)

Pass existing data as the **first** parameter to `superValidate()` to pre-populate the form:

```typescript
// load
const form = await superValidate(existingUser, valibot(userSchema));
```

### Multi-Step Wizard

Validate the current step before advancing. Compose per-step schemas, then merge for the final submit via `entries` spread:

```typescript
export const wizardSchema = v.object({
  ...step1Schema.entries,
  ...step2Schema.entries,
  ...step3Schema.entries,
});
```

```typescript
const { validate } = superForm(data.form, {
  validators: valibotClient(schemas[currentStep - 1]),
});

async function nextStep() {
  const result = await validate();
  if (result.valid) currentStep++;
}
```

### Dependent Fields (Cascade)

Derive child options from the parent value and reset children when the parent changes:

```svelte
<script>
  let states = $derived($form.country ? data.statesByCountry[$form.country] ?? [] : []);

  $effect(() => {
    if ($form.country) { $form.state = ''; $form.city = ''; }
  });
</script>
```

### Confirmation Modal

Cancel auto-submit in `onSubmit`, show the dialog, then call `submit()` programmatically on confirm:

```typescript
const { enhance, submit } = superForm(data.form, {
  onSubmit({ cancel }) {
    cancel();
    showConfirm = true;
  },
});
```

Use the project [`ConfirmDialog`](./design/components.md) composite — not a raw modal.

### File Upload

The real file-upload form in v10r is the **image-metadata showcase**: schema in `$lib/schemas/showcase/image-metadata.ts`, server resolver in `$lib/server/imagemeta/`. The upload is processed server-side with Sharp and stored in [R2](../stack/data/r2.md).

It validates the **metadata** about the image (title, alt text, keywords, category, optional GPS) through Superforms + Valibot — not the file bytes. The codebase does **not** use Valibot file validators (`v.file`, `v.mimeType`, `v.maxSize`) or `withFiles()` anywhere; file constraints are enforced in the server resolver.

> If you do need schema-level file validation in a new form, Valibot v1 offers `v.file` / `v.mimeType` / `v.maxSize`, and Superforms offers `withFiles()` on `fail`. Neither is currently used in this repo. A form that posts files needs `enctype="multipart/form-data"`; client-side preview via `URL.createObjectURL(file)`.

### Array / Dynamic Fields — v10r Gotcha

> **Progressive Enhancement Warning:** `dataType: 'json'` **breaks** the no-JS path. The form will NOT work without JavaScript, `use:enhance` is mandatory, and `disabled` is ignored (all `$form` data posts regardless). Only use it for nested objects/arrays where a no-JS fallback isn't required.

A top-level array of primitives works in the default `dataType: 'form'` mode **only if each element is backed by a real DOM input named after the field** — Superforms reads it server-side via `formData.getAll('fieldName')`.

A `bind:value`-only component that renders no named inputs (a tag-chips / `TagInput`-style component) silently posts an **empty array**: the server receives `[]` and the data is lost. Two fixes:

- **Mirror each element in a hidden named input** (progressive-enhancement-friendly — array still posts with JS off):

  ```svelte
  <TagInput bind:value={$form.keywords} />
  {#each $form.keywords as keyword}
    <input type="hidden" name="keywords" value={keyword} />
  {/each}
  ```

- **Switch to `dataType: 'json'`** — but this breaks the no-JS path (see the warning above).

### Async Validation (Server-Side Checks)

For username availability / email uniqueness, v10r **does not** use a Valibot async schema. The Superforms schema stays synchronous; the availability check is a separate debounced `fetch` to a dedicated, rate-limited API endpoint, decoupled from Superforms/Valibot validation.

The `/showcases/forms/validation/async` example wires it this way:

1. The form validates against a plain sync `v.object` (`asyncSchema` in `$lib/schemas/showcase/validation.ts`) via `superValidate(request, valibot(asyncSchema))`.
2. An `oninput` handler debounces (~400ms), then `fetch`es `/api/showcases/check-username?u=…`, which returns `{ available }`.
3. The endpoint (`src/routes/api/showcases/check-username/+server.ts`) is a rate-limited `GET` — the gate lives server-side, not in the form schema.

```typescript
// client — debounced check, independent of Superforms
debounceTimer = setTimeout(async () => {
  const res = await fetch(`/api/showcases/check-username?u=${encodeURIComponent(username)}`);
  const { data: { available } } = await res.json();
  if ($form.username === username) usernameAvailable = available;
}, 400);
```

> Valibot does ship async schemas (`v.objectAsync` + `v.pipeAsync` + `v.checkAsync`) for inline server checks, but **v10r does not use them** — the dedicated-endpoint pattern above is the project convention.

---

## Mobile UX

### Input Types and inputmode

Use the right combination of `type`, `inputmode`, and `autocomplete`:

| Field Type | type | inputmode | autocomplete |
|------------|------|-----------|--------------|
| Email | `email` | `email` | `email` |
| Phone | `tel` | `tel` | `tel` |
| Numeric code | `text` | `numeric` | `one-time-code` |
| Decimal price | `text` | `decimal` | — |
| URL | `url` | `url` | `url` |
| Search | `search` | `search` | — |

2FA code field: `type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6"`.

### Touch Targets

| Standard | Level | Minimum Size |
|----------|-------|--------------|
| WCAG 2.2 | AA (required) | 24×24 CSS px |
| WCAG 2.1 | AAA (recommended) | 44×44 CSS px |

### iOS Safari Zoom Prevention

iOS Safari zooms in on inputs with `font-size < 16px`. Use the accessible fix:

```css
input, select, textarea {
  font-size: max(16px, 1rem);
}
```

**Never use** `maximum-scale=1` in the viewport meta tag — it breaks accessibility by preventing all user zooming.

---

## Accessibility

These patterns are **mandated** for v10r forms.

| Requirement | Implementation |
|-------------|----------------|
| **Labels** | Every input has an associated `<label>` |
| **Error announcements** | `role="alert"` on error messages |
| **Invalid state** | `aria-invalid="true"` on invalid inputs |
| **Error description** | `aria-describedby` linking to the error |
| **Focus management** | Focus the first error on submit failure |
| **Loading state** | `aria-busy="true"` during submission |

### aria-live for Real-Time Validation

Pre-register live regions in the DOM on page load (empty containers work) so screen readers announce errors as they appear:

```svelte
<div aria-live="polite" aria-atomic="true">
  {#if $errors.email}
    <span id="email-error">{$errors.email}</span>
  {/if}
</div>

<input
  id="email"
  type="email"
  bind:value={$form.email}
  aria-invalid={$errors.email ? 'true' : undefined}
  aria-describedby={$errors.email ? 'email-error' : undefined}
/>
```

| Attribute | Use Case |
|-----------|----------|
| `aria-live="polite"` | Form validation errors (waits for pause) |
| `aria-live="assertive"` | Critical security alerts (interrupts) |
| `role="alert"` | Form-level errors (equivalent to assertive + atomic) |

**iOS VoiceOver:** add `aria-atomic="true"` for repeated announcements.

### Positive Feedback (Success States)

Show a checkmark on valid fields to reassure users:

```svelte
{#if $form.email && !$errors.email}
  <span class="success-icon" aria-label="Valid">✓</span>
{/if}
```

### Focus First Error

```typescript
const { enhance } = superForm(data.form, {
  onResult({ result }) {
    if (result.type === 'failure') {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError instanceof HTMLElement) firstError.focus();
    }
  },
});
```

---

## Constraints

### Prerendering

**Pages with form actions cannot be prerendered** — form actions need a server to handle POST.

```typescript
// ❌ Errors at build time
export const prerender = true;
export const actions: Actions = { default: async () => { /* ... */ } };
```

**Workaround:** use a `+server.ts` API route (can coexist with a prerendered page) and `superValidate(request, ...)` inside the `POST` handler.

---

## File Structure

Schemas live nested by domain under `$lib/schemas/` — no barrel `index.ts`:

```
src/lib/schemas/
├── style.ts                  # Top-level shared schema
├── app/                      # Settings, branding, notification preferences
├── admin/                    # Admin flags, model usage
├── blog/                     # Comments
├── dbops/                    # DB-ops operations
└── showcase/                 # Per-showcase form schemas
    ├── validation.ts         # realtime / async / server-check demos
    ├── image-metadata.ts     # File-upload metadata (see File Upload)
    └── …
```

Route-specific schemas stay at the top of their `+page.server.ts`.

---

## Summary

| What | How |
|------|-----|
| Form library | Superforms v2 |
| Validation | Valibot schemas (sync + async) |
| Auth forms | Better Auth client, NOT Superforms |
| Timing | Default `'auto'` (reward early, validate late) + context-aware debounce |
| Errors | Inline + form message + toast (with priority hierarchy) |
| Enhancement | `use:enhance` for no-reload |
| Mobile | Touch targets, inputmode, iOS zoom prevention |
| Files | Image-metadata showcase + Sharp + [R2](../stack/data/r2.md) (no `withFiles()`/`v.file`) |

---

## Related

- [design/components.md](./design/components.md) - Form field components (Input, Select, FormField)
- [design/tokens.md](./design/tokens.md) - Design tokens for form styling
- [auth.md](./auth.md) - Login/register form implementations
- [error-handling.md](./error-handling.md) - Error display patterns
- [pages.md](./pages.md) - `/showcases/forms` route

---

## Sources

- [Superforms Documentation](https://superforms.rocks/)
- [Valibot Documentation](https://valibot.dev/)
- [SvelteKit Form Actions](https://svelte.dev/docs/kit/form-actions)
- [WCAG 2.2 Target Size Minimum (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [ARIA Live Regions (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [Inline Validation UX (Smashing Magazine)](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/)
