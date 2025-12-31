# Forms Architecture

Type-safe forms with real-time validation using Superforms and Valibot.

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

### Why Valibot over Zod

| Feature | Valibot | Zod |
|---------|---------|-----|
| Bundle size | ~1KB per schema | ~12KB base |
| Tree-shaking | Full | Partial |
| Performance | Faster validation | Slower |
| API | Pipe-based | Chained |

---

## Installation

```bash
bun add sveltekit-superforms valibot
```

---

## Schema Patterns

### Location Strategy

| Schema Type | Location | Example |
|-------------|----------|---------|
| Route-specific | Top of `+page.server.ts` | Login form |
| Shared/reused | `$lib/schemas/*.ts` | User profile |
| Complex nested | `$lib/schemas/*.ts` | Address, wizard steps |

### Schema Definition

```typescript
// src/lib/schemas/auth.ts
import * as v from 'valibot';

// Email entry for magic link / OTP
export const emailSchema = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty('Email is required'),
    v.email('Invalid email address')
  ),
});

// OTP verification
export const otpSchema = v.object({
  code: v.pipe(
    v.string(),
    v.nonEmpty('Code is required'),
    v.length(6, 'Code must be 6 digits'),
    v.regex(/^\d+$/, 'Code must contain only numbers')
  ),
});

export type EmailSchema = v.InferInput<typeof emailSchema>;
export type OtpSchema = v.InferInput<typeof otpSchema>;
```

### Nested Objects

```typescript
// src/lib/schemas/address.ts
import * as v from 'valibot';

export const addressSchema = v.object({
  street: v.pipe(v.string(), v.nonEmpty('Street is required')),
  city: v.pipe(v.string(), v.nonEmpty('City is required')),
  state: v.pipe(v.string(), v.nonEmpty('State is required')),
  zip: v.pipe(
    v.string(),
    v.nonEmpty('ZIP is required'),
    v.regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')
  ),
  country: v.pipe(v.string(), v.nonEmpty('Country is required')),
});

export const userWithAddressSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  email: v.pipe(v.string(), v.email()),
  address: addressSchema,
});
```

---

## Server Integration

### Basic Form Action

```typescript
// src/routes/app/profile/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { profileSchema } from '$lib/schemas/user';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  const form = await superValidate(locals.user, valibot(profileSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, valibot(profileSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Update profile
    await db.update(userProfile)
      .set({ name: form.data.name, bio: form.data.bio })
      .where(eq(userProfile.userId, locals.user.id));

    return message(form, 'Profile updated!');
  },
};
```

### Named Actions

```typescript
// src/routes/showcase/data/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { createItemSchema, filterSchema } from '$lib/schemas/items';

export const load: PageServerLoad = async () => {
  return {
    createForm: await superValidate(valibot(createItemSchema)),
    filterForm: await superValidate(valibot(filterSchema)),
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, valibot(createItemSchema));
    if (!form.valid) return fail(400, { form });
    // ... create item
    return { form };
  },

  filter: async ({ request }) => {
    const form = await superValidate(request, valibot(filterSchema));
    if (!form.valid) return fail(400, { form });
    // ... apply filters
    return { form };
  },
};
```

---

## Client Integration

### Basic Form

```svelte
<!-- src/routes/app/profile/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { profileSchema } from '$lib/schemas/user';
  import { toast } from '$lib/stores/toast.svelte';

  let { data }: PageProps = $props();

  const { form, errors, enhance, submitting, message } = superForm(data.form, {
    validators: valibotClient(profileSchema),

    // "Reward early, validate late" pattern (recommended default)
    // Validates on blur for pristine fields, on input after errors appear
    // validationMethod: 'auto', // This is the default, no need to specify

    delayMs: 150,  // Fast for client-side validation

    // Error handling
    onError({ result }) {
      toast.error(result.error.message || 'Something went wrong');
    },

    // Success handling
    onResult({ result }) {
      if (result.type === 'success') {
        toast.success('Profile updated!');
      }
    },
  });
</script>

<form method="POST" use:enhance>
  <div class="form-field">
    <label for="name">Display Name</label>
    <input
      id="name"
      name="name"
      type="text"
      bind:value={$form.name}
      aria-invalid={$errors.name ? 'true' : undefined}
      aria-describedby={$errors.name ? 'name-error' : undefined}
    />
    {#if $errors.name}
      <span id="name-error" class="error">{$errors.name}</span>
    {/if}
  </div>

  <div class="form-field">
    <label for="bio">Bio</label>
    <textarea
      id="bio"
      name="bio"
      bind:value={$form.bio}
      aria-invalid={$errors.bio ? 'true' : undefined}
    />
    {#if $errors.bio}
      <span class="error">{$errors.bio}</span>
    {/if}
  </div>

  {#if $message}
    <div class="form-message" role="status">{$message}</div>
  {/if}

  <button type="submit" disabled={$submitting}>
    {$submitting ? 'Saving...' : 'Save Profile'}
  </button>
</form>
```

### Validation Timing

**Default: `'auto'` (recommended)** — Implements the research-backed "reward early, validate late" pattern:
- Validates on **blur** for pristine fields (avoids interrupting typing)
- Validates on **input** only after errors appear (quick correction feedback)

```typescript
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),

  // Default behavior (no need to specify):
  // validationMethod: 'auto',

  // Override only when needed:
  // validationMethod: 'oninput',      // Real-time (password strength, char count)
  // validationMethod: 'onblur',       // Only when leaving field
  // validationMethod: 'submit-only',  // Only on submit

  delayMs: 150, // Debounce delay (see guidelines below)
});
```

**Decision tree for validation timing:**

| Question | Answer | Use |
|----------|--------|-----|
| Need real-time feedback? (password strength, live char count) | Yes | `'oninput'` |
| Does validation require server call? (username availability) | Yes | `'oninput'` + `delayMs: 500` |
| Is the form complex with expensive validation? | Yes | `'onblur'` |
| Standard form fields? | Yes | `'auto'` (default) |

### Debounce Timing Guidelines

Research shows **100-300ms** feels instant, while **>300ms** feels sluggish. Choose based on validation type:

| Validation Type | Recommended Delay | Rationale |
|-----------------|-------------------|-----------|
| Client-side only | **150ms** | Fast feedback, no API cost |
| Mixed client/server | **300ms** | Balance responsiveness and efficiency |
| Async server checks | **500ms** | Reduce API calls, wait for typing pause |

**Examples by use case:**

```typescript
// Standard forms (use default 'auto' behavior)
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),
  // validationMethod: 'auto' is the default
  delayMs: 150,
});

// Real-time feedback (password strength, character count)
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),
  validationMethod: 'oninput',  // Override default for real-time
  delayMs: 150,
});

// Async validation (username availability check)
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),
  validationMethod: 'oninput',
  delayMs: 500,  // Higher delay to reduce server requests
});

// Complex forms with expensive validation
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),
  validationMethod: 'onblur',  // Only validate when leaving field
});
```

**Key insight:** The default `'auto'` mode is research-backed and works best for most forms. Only override when you have a specific reason (real-time feedback, expensive validation, or server-side checks).

---

## Error Display Patterns

### 1. Inline Errors (Field-Level)

```svelte
<div class="form-field">
  <label for="email">Email</label>
  <input
    id="email"
    name="email"
    type="email"
    bind:value={$form.email}
    class={$errors.email ? 'input-error' : ''}
  />
  {#if $errors.email}
    <span class="text-error text-sm">{$errors.email}</span>
  {/if}
</div>
```

### 2. Form-Level Message

```svelte
{#if $message}
  <div class="alert alert-error" role="alert">
    {$message}
  </div>
{/if}
```

### 3. Toast Notifications

```typescript
const { enhance } = superForm(data.form, {
  onError({ result }) {
    toast.error(result.error.message);
  },
  onResult({ result }) {
    if (result.type === 'success') {
      toast.success('Changes saved!');
    }
  },
});
```

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

**Implementation:**

```typescript
const { form, errors, enhance, message } = superForm(data.form, {
  validators: valibotClient(schema),

  onError({ result }) {
    // Priority 1: Network/connection errors
    if (result.error?.message?.includes('fetch')) {
      toast.error('Connection lost. Please check your network.');
      return; // Don't show field errors
    }

    // Priority 2-3: Server errors (handled by message)
    // Let form-level $message display these
  },

  onResult({ result }) {
    if (result.type === 'failure') {
      // Priority 5: Multiple field errors — focus first invalid field
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError instanceof HTMLElement) {
        firstError.focus();
      }
    }

    if (result.type === 'success') {
      toast.success('Changes saved!');
    }
  },
});
```

**Form template with hierarchy:**

```svelte
<form method="POST" use:enhance>
  <!-- Priority 2-3: Form-level message (server errors, rate limits) -->
  {#if $message}
    <div class="form-error" role="alert">{$message}</div>
  {/if}

  <!-- Priority 5-6: Field-level errors -->
  <div class="form-field">
    <label for="email">Email</label>
    <input
      id="email"
      name="email"
      type="email"
      bind:value={$form.email}
      aria-invalid={$errors.email ? 'true' : undefined}
    />
    {#if $errors.email}
      <span class="error">{$errors.email}</span>
    {/if}
  </div>

  <!-- ... more fields ... -->
</form>

<!-- Priority 1: Toast container for network errors (rendered at app root) -->
```

---

## Data Invalidation After Form Actions

### Default Behavior

Form actions using `use:enhance` trigger `invalidateAll()` after successful submission, re-running all load functions on the current page.

### When to Use Each Pattern

| Pattern | Use Case | Example |
|---------|----------|---------|
| `invalidateAll: true` (default) | User login/logout | Update global user state |
| `invalidate('/api/items')` | Item CRUD on list page | Refresh items list only |
| `invalidateAll: false` + local state | Real-time preview | Update component state without refetch |
| `goto()` + automatic invalidation | Create → Detail page | Navigate + fresh data |
| Redirect from server | Create → List page | `redirect(303, '/items')` |

### Superforms Invalidation Options

```typescript
const { form, enhance } = superForm(data.form, {
  // Default: refresh all data after success
  invalidateAll: true,

  // Or: specify what to invalidate on success
  onResult({ result }) {
    if (result.type === 'success') {
      invalidate('/api/items'); // Only refresh items
    }
  },

  // Or: disable auto-invalidation for optimistic updates
  invalidateAll: false,
});
```

### Optimistic Updates Pattern

Update UI immediately, sync with server in background:

```typescript
let items = $state(data.items);

const { form, enhance } = superForm(data.form, {
  invalidateAll: false, // Don't refetch — we'll update locally

  onSubmit() {
    // Optimistic: add item immediately with temp ID
    const tempId = `temp_${Date.now()}`;
    items = [...items, { id: tempId, ...formData }];
  },

  onResult({ result }) {
    if (result.type === 'success' && result.data?.item) {
      // Replace temp with real item from server
      items = items.map(i =>
        i.id.startsWith('temp_') ? result.data.item : i
      );
    }
  },

  onError() {
    // Rollback: remove optimistic item
    items = items.filter(i => !i.id.startsWith('temp_'));
    toast.error('Failed to create item');
  },
});
```

### Server-Side Redirect vs Client-Side Invalidation

**Prefer server-side redirect** when navigating after mutation:

```typescript
// +page.server.ts — Server redirect (recommended)
export const actions = {
  create: async ({ request }) => {
    // ... create item
    redirect(303, '/showcase/data'); // Automatic invalidation
  },
};
```

**Use client-side invalidation** when staying on page:

```typescript
// +page.svelte — Stay on page, refresh data
const { enhance } = superForm(data.form, {
  onResult({ result }) {
    if (result.type === 'success') {
      invalidate('app:items'); // Custom invalidation key
      toast.success('Item created!');
    }
  },
});
```

---

## Form Patterns

### Settings Form (Multi-Section)

```svelte
<!-- src/routes/app/settings/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { settingsSchema } from '$lib/schemas/user';

  let { data }: PageProps = $props();

  const { form, errors, enhance, submitting, tainted } = superForm(data.form, {
    validators: valibotClient(settingsSchema),
    // Using default 'auto' validation (reward early, validate late)
    delayMs: 150,
  });
</script>

<form method="POST" use:enhance>
  <!-- Profile Section -->
  <section>
    <h2>Profile</h2>

    <div class="form-field">
      <label for="name">Display Name</label>
      <input id="name" name="name" bind:value={$form.name} />
      {#if $errors.name}<span class="error">{$errors.name}</span>{/if}
    </div>

    <div class="form-field">
      <label for="bio">Bio</label>
      <textarea id="bio" name="bio" bind:value={$form.bio}></textarea>
      {#if $errors.bio}<span class="error">{$errors.bio}</span>{/if}
    </div>
  </section>

  <!-- Preferences Section -->
  <section>
    <h2>Preferences</h2>

    <div class="form-field">
      <label for="timezone">Timezone</label>
      <select id="timezone" name="timezone" bind:value={$form.timezone}>
        <option value="UTC">UTC</option>
        <option value="America/New_York">Eastern</option>
        <option value="America/Los_Angeles">Pacific</option>
      </select>
    </div>
  </section>

  <footer>
    <button type="submit" disabled={$submitting || !$tainted}>
      {$submitting ? 'Saving...' : 'Save Changes'}
    </button>
  </footer>
</form>
```

### Multi-Step Wizard

```typescript
// src/lib/schemas/wizard.ts
import * as v from 'valibot';

export const step1Schema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  email: v.pipe(v.string(), v.email()),
});

export const step2Schema = v.object({
  company: v.pipe(v.string(), v.nonEmpty()),
  role: v.pipe(v.string(), v.nonEmpty()),
});

export const step3Schema = v.object({
  plan: v.picklist(['free', 'pro', 'enterprise']),
  terms: v.literal(true, 'You must accept the terms'),
});

// Combined for final submission
export const wizardSchema = v.object({
  ...step1Schema.entries,
  ...step2Schema.entries,
  ...step3Schema.entries,
});
```

```svelte
<!-- src/routes/onboarding/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { step1Schema, step2Schema, step3Schema } from '$lib/schemas/wizard';

  let { data }: PageProps = $props();
  let currentStep = $state(1);

  const schemas = [step1Schema, step2Schema, step3Schema];

  const { form, errors, enhance, validate } = superForm(data.form, {
    validators: valibotClient(schemas[currentStep - 1]),
    // Using default 'auto' validation
    delayMs: 150,
  });

  async function nextStep() {
    const result = await validate();
    if (result.valid) {
      currentStep++;
    }
  }

  function prevStep() {
    currentStep--;
  }
</script>

<form method="POST" use:enhance>
  <!-- Progress indicator -->
  <div class="steps">
    {#each [1, 2, 3] as step}
      <div class="step" class:active={step === currentStep} class:complete={step < currentStep}>
        {step}
      </div>
    {/each}
  </div>

  <!-- Step content -->
  {#if currentStep === 1}
    <div class="step-content">
      <h2>Personal Info</h2>
      <!-- Step 1 fields -->
    </div>
  {:else if currentStep === 2}
    <div class="step-content">
      <h2>Company Info</h2>
      <!-- Step 2 fields -->
    </div>
  {:else}
    <div class="step-content">
      <h2>Choose Plan</h2>
      <!-- Step 3 fields -->
    </div>
  {/if}

  <!-- Navigation -->
  <footer>
    {#if currentStep > 1}
      <button type="button" onclick={prevStep}>Back</button>
    {/if}

    {#if currentStep < 3}
      <button type="button" onclick={nextStep}>Next</button>
    {:else}
      <button type="submit">Complete Setup</button>
    {/if}
  </footer>
</form>
```

### Dependent Fields

```svelte
<!-- Country → State → City cascade -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';

  let { data }: PageProps = $props();

  const { form, enhance } = superForm(data.form);

  // Derived state for dependent options
  let states = $derived(
    $form.country ? data.statesByCountry[$form.country] ?? [] : []
  );

  let cities = $derived(
    $form.state ? data.citiesByState[$form.state] ?? [] : []
  );

  // Reset dependent fields when parent changes
  $effect(() => {
    if ($form.country) {
      $form.state = '';
      $form.city = '';
    }
  });

  $effect(() => {
    if ($form.state) {
      $form.city = '';
    }
  });
</script>

<form method="POST" use:enhance>
  <select name="country" bind:value={$form.country}>
    <option value="">Select country</option>
    {#each data.countries as country}
      <option value={country.code}>{country.name}</option>
    {/each}
  </select>

  <select name="state" bind:value={$form.state} disabled={!$form.country}>
    <option value="">Select state</option>
    {#each states as state}
      <option value={state.code}>{state.name}</option>
    {/each}
  </select>

  <select name="city" bind:value={$form.city} disabled={!$form.state}>
    <option value="">Select city</option>
    {#each cities as city}
      <option value={city}>{city}</option>
    {/each}
  </select>
</form>
```

### Confirmation Modal

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';
  import { ConfirmDialog } from '$lib/components/composites';

  let { data }: PageProps = $props();
  let showConfirm = $state(false);

  const { form, enhance, submit } = superForm(data.form, {
    // Prevent auto-submit, we'll handle it
    onSubmit({ cancel }) {
      cancel();
      showConfirm = true;
    },
  });

  function handleConfirm() {
    showConfirm = false;
    submit(); // Programmatic submit
  }
</script>

<form method="POST" use:enhance>
  <!-- Form fields -->
  <button type="submit">Delete Account</button>
</form>

<ConfirmDialog
  open={showConfirm}
  title="Delete Account?"
  description="This action cannot be undone. All your data will be permanently deleted."
  confirmLabel="Yes, delete my account"
  onconfirm={handleConfirm}
  oncancel={() => showConfirm = false}
/>
```

### File Upload (Avatar)

```typescript
// src/routes/app/settings/avatar/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { superValidate, withFiles } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';
import { uploadToR2 } from '$lib/server/storage';
import sharp from 'sharp';

const avatarSchema = v.object({
  avatar: v.pipe(
    v.file(),
    v.mimeType(['image/jpeg', 'image/png', 'image/webp'], 'Must be an image'),
    v.maxSize(5 * 1024 * 1024, 'Max 5MB')
  ),
});

export const load: PageServerLoad = async () => {
  const form = await superValidate(valibot(avatarSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, valibot(avatarSchema));

    if (!form.valid) {
      return fail(400, withFiles({ form }));
    }

    const file = form.data.avatar;

    // Process with Sharp
    const buffer = await file.arrayBuffer();
    const processed = await sharp(Buffer.from(buffer))
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload to R2
    const url = await uploadToR2(processed, `avatars/${locals.user.id}.webp`);

    // Update user record
    await db.update(user)
      .set({ image: url })
      .where(eq(user.id, locals.user.id));

    return { form, avatarUrl: url };
  },
};
```

```svelte
<!-- src/routes/app/settings/avatar/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';

  let { data }: PageProps = $props();
  let preview = $state<string | null>(null);

  const { form, errors, enhance, submitting } = superForm(data.form);

  function handleFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      preview = URL.createObjectURL(file);
    }
  }
</script>

<form method="POST" enctype="multipart/form-data" use:enhance>
  <div class="avatar-upload">
    {#if preview}
      <img src={preview} alt="Preview" class="avatar-preview" />
    {:else if data.currentAvatar}
      <img src={data.currentAvatar} alt="Current avatar" class="avatar-preview" />
    {:else}
      <div class="avatar-placeholder">No avatar</div>
    {/if}

    <input
      type="file"
      name="avatar"
      accept="image/jpeg,image/png,image/webp"
      onchange={handleFileSelect}
    />

    {#if $errors.avatar}
      <span class="error">{$errors.avatar}</span>
    {/if}
  </div>

  <button type="submit" disabled={$submitting}>
    {$submitting ? 'Uploading...' : 'Upload Avatar'}
  </button>
</form>
```

### Edit Form (Loading Existing Data)

```typescript
// src/routes/app/users/[id]/edit/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { userSchema } from '$lib/schemas/user';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, params.id)
  });

  if (!existingUser) {
    error(404, 'User not found');
  }

  // Pass existing data as first parameter to populate form
  const form = await superValidate(existingUser, valibot(userSchema));

  return { form };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await superValidate(request, valibot(userSchema));

    if (!form.valid) return fail(400, { form });

    await db.update(users)
      .set(form.data)
      .where(eq(users.id, params.id));

    return { form };
  },
};
```

**Key pattern:** Pass existing data as the first parameter to `superValidate()`. The form will be pre-populated with those values.

### Array/Dynamic Fields

For forms with dynamic lists (tags, items, etc.), use `dataType: 'json'`:

```typescript
// src/lib/schemas/tags.ts
import * as v from 'valibot';

export const tagsSchema = v.object({
  tags: v.pipe(
    v.array(v.object({
      id: v.optional(v.number()),
      name: v.pipe(v.string(), v.nonEmpty('Tag name required')),
    })),
    v.minLength(1, 'At least one tag required')
  ),
});
```

```svelte
<!-- src/routes/items/[id]/tags/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { tagsSchema } from '$lib/schemas/tags';

  let { data }: PageProps = $props();

  const { form, errors, enhance } = superForm(data.form, {
    validators: valibotClient(tagsSchema),
    dataType: 'json', // Required for nested arrays/objects
  });

  function addTag() {
    $form.tags = [...$form.tags, { id: undefined, name: '' }];
  }

  function removeTag(index: number) {
    $form.tags = $form.tags.filter((_, i) => i !== index);
  }
</script>

<form method="POST" use:enhance>
  {#each $form.tags as tag, i}
    <div class="tag-field">
      <input
        type="text"
        bind:value={tag.name}
        placeholder="Tag name"
        aria-invalid={$errors.tags?.[i]?.name ? 'true' : undefined}
      />
      <button type="button" onclick={() => removeTag(i)}>Remove</button>
      {#if $errors.tags?.[i]?.name}
        <span class="error">{$errors.tags[i].name}</span>
      {/if}
    </div>
  {/each}

  <button type="button" onclick={addTag}>Add Tag</button>
  <button type="submit">Save</button>
</form>
```

**Important:** `dataType: 'json'` is required for nested arrays and objects. Arrays of primitives at the top level don't require it.

### Async Validation (Server-Side Checks)

For validations requiring server calls (username availability, email uniqueness):

```typescript
// src/lib/schemas/register.ts
import * as v from 'valibot';

// Async check function
async function isUsernameAvailable(username: string): Promise<boolean> {
  const response = await fetch(`/api/check-username?u=${username}`);
  const { available } = await response.json();
  return available;
}

// Use objectAsync when ANY field has async validation
export const registerSchema = v.objectAsync({
  username: v.pipeAsync(
    v.string(),
    v.nonEmpty('Username is required'),
    v.minLength(3, 'At least 3 characters'),
    v.checkAsync(isUsernameAvailable, 'Username already taken')
  ),
  // Synchronous fields can still use regular pipe
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
});
```

**Key rules:**
1. Use `objectAsync` if **any** field has async validation
2. Use `pipeAsync` + `checkAsync` for async checks
3. Synchronous fields can still use `pipe` (not `pipeAsync`) within an async schema
4. Increase `delayMs` to 500ms to reduce server requests

```svelte
<script lang="ts">
  const { form, enhance } = superForm(data.form, {
    validators: valibotClient(registerSchema),
    validationMethod: 'oninput',  // Override 'auto' for real-time feedback
    delayMs: 500, // Higher delay for server requests
  });
</script>
```

### Form Reset After Success

For forms that should clear after submission (contact, feedback):

```typescript
const { form, enhance } = superForm(data.form, {
  resetForm: true, // Reset to initial values after success

  // Or conditional reset:
  onResult({ result }) {
    if (result.type === 'success') {
      // Custom reset logic
      $form.email = '';
      $form.message = '';
      toast.success('Message sent!');
    }
  },
});
```

---

## Mobile UX

Mobile form usability requires specific attention to input types, touch targets, and keyboard behavior.

### Input Types and inputmode

Use the right combination of `type`, `inputmode`, and `autocomplete`:

| Field Type | type | inputmode | autocomplete | Result |
|------------|------|-----------|--------------|--------|
| Email | `email` | `email` | `email` | Email keyboard |
| Phone | `tel` | `tel` | `tel` | Phone keypad |
| Numeric code | `text` | `numeric` | `one-time-code` | Number pad |
| Decimal price | `text` | `decimal` | — | Numeric with decimal |
| URL | `url` | `url` | `url` | URL keyboard |
| Search | `search` | `search` | — | Search keyboard |

```svelte
<!-- Email field -->
<input
  type="email"
  inputmode="email"
  autocomplete="email"
  bind:value={$form.email}
/>

<!-- Phone number -->
<input
  type="tel"
  inputmode="tel"
  autocomplete="tel"
  bind:value={$form.phone}
/>

<!-- 2FA code -->
<input
  type="text"
  inputmode="numeric"
  autocomplete="one-time-code"
  pattern="[0-9]*"
  maxlength="6"
  bind:value={$form.code}
/>

<!-- Price input -->
<input
  type="text"
  inputmode="decimal"
  bind:value={$form.price}
/>
```

### Touch Target Sizes

Minimum touch targets for accessibility:

| Standard | Level | Minimum Size |
|----------|-------|--------------|
| WCAG 2.2 | AA (required) | 24×24 CSS px |
| WCAG 2.1 | AAA (recommended) | 44×44 CSS px |

```css
/* UnoCSS shortcuts for form controls */
button, input, select, textarea {
  min-height: 44px;  /* Touch-friendly */
  padding: 12px 16px;
}

/* Checkboxes and radio buttons */
input[type="checkbox"], input[type="radio"] {
  width: 24px;
  height: 24px;
}
```

### iOS Safari Zoom Prevention

iOS Safari zooms in on inputs with `font-size < 16px`. Use the accessible solution:

```css
/* Accessible fix (recommended) */
input, select, textarea {
  font-size: max(16px, 1rem);
}
```

**Never use** `maximum-scale=1` in the viewport meta tag — it breaks accessibility by preventing all user zooming.

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Labels** | Every input has associated `<label>` |
| **Error announcements** | `role="alert"` on error messages |
| **Invalid state** | `aria-invalid="true"` on invalid inputs |
| **Error description** | `aria-describedby` linking to error |
| **Focus management** | Focus first error on submit failure |
| **Loading state** | `aria-busy="true"` during submission |

### aria-live for Real-Time Validation

Pre-register live regions in the DOM on page load (empty containers work):

```svelte
<form method="POST" use:enhance>
  <!-- Pre-registered error container -->
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
</form>
```

**When to use each:**

| Attribute | Use Case |
|-----------|----------|
| `aria-live="polite"` | Form validation errors (waits for pause) |
| `aria-live="assertive"` | Critical security alerts (interrupts) |
| `role="alert"` | Form-level errors (equivalent to assertive + atomic) |

**iOS VoiceOver:** Add `aria-atomic="true"` for repeated announcements.

### Positive Feedback (Success States)

Show success indicators for valid fields to improve UX:

```svelte
<div class="form-field">
  <label for="email">Email</label>
  <div class="input-wrapper">
    <input
      id="email"
      type="email"
      bind:value={$form.email}
      aria-invalid={$errors.email ? 'true' : undefined}
    />
    {#if $form.email && !$errors.email}
      <span class="success-icon" aria-label="Valid">✓</span>
    {/if}
  </div>
  {#if $errors.email}
    <span class="error" role="alert">{$errors.email}</span>
  {/if}
</div>
```

**Benefits:**
- Provides sense of accomplishment and progress
- Reassures risk-averse users
- Reduces need to review completed fields

**Color coding:**
- ✓ Green: Success/valid
- ✗ Red: Errors
- ℹ Blue: Information
- ⚠ Yellow: Warnings

### Focus First Error

```typescript
const { enhance } = superForm(data.form, {
  onResult({ result }) {
    if (result.type === 'failure') {
      // Focus first invalid field
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError instanceof HTMLElement) {
        firstError.focus();
      }
    }
  },
});
```

---

## Constraints

### Prerendering

**Pages with form actions cannot be prerendered.**

```typescript
// ❌ This will error at build time
export const prerender = true;

export const actions: Actions = {
  default: async () => { /* ... */ }
};
```

**Reason:** Form actions require a server to handle POST requests.

**Workaround:** Use `+server.ts` API routes instead:

```typescript
// +server.ts (can coexist with prerendered page)
export async function POST({ request }) {
  const form = await superValidate(request, valibot(schema));
  // ...
  return json({ form });
}
```

See [SvelteKit Page Options](https://kit.svelte.dev/docs/page-options) for details.

---

## File Structure

```
src/
├── lib/
│   └── schemas/
│       ├── auth.ts           # Email, OTP verification
│       ├── user.ts           # Profile, settings
│       ├── address.ts        # Nested address object
│       ├── wizard.ts         # Multi-step form schemas
│       └── index.ts          # Barrel export
└── routes/
    ├── auth/
    │   ├── login/
    │   │   └── +page.svelte  # Email entry (Better Auth client)
    │   └── verify/
    │       └── +page.svelte  # OTP entry (Better Auth client)
    └── app/
        └── settings/
            ├── +page.svelte
            ├── +page.server.ts
            └── avatar/
                ├── +page.svelte
                └── +page.server.ts
```

---

## Summary

| What | How |
|------|-----|
| Form library | Superforms v2 |
| Validation | Valibot schemas (sync + async) |
| Timing | Default `'auto'` (reward early, validate late) with context-aware debounce |
| Errors | Inline + form message + toast (with priority hierarchy) |
| Success states | Positive feedback with checkmarks |
| Enhancement | `use:enhance` for no-reload |
| Mobile | Touch targets, inputmode, iOS zoom prevention |
| Files | `withFiles()` + Sharp + [R2](../stack/vendors.md#cloudflare-r2) |

---

## Related

- [design/components.md](./design/components.md) - Form field components (Input, Select, FormField)
- [design/tokens.md](./design/tokens.md) - Design tokens for form styling
- [auth.md](./auth.md) - Login/register form implementations
- [error-handling.md](./error-handling.md) - Error display patterns
- [pages.md](./pages.md) - `/showcase/forms` route

---

## Sources

### Core Libraries
- [Superforms Documentation](https://superforms.rocks/)
- [Superforms Client Validation](https://superforms.rocks/concepts/client-validation)
- [Valibot Documentation](https://valibot.dev/)
- [Valibot Async Validation](https://valibot.dev/guides/async-validation/)
- [SvelteKit Form Actions](https://svelte.dev/docs/kit/form-actions)
- [SvelteKit Page Options](https://kit.svelte.dev/docs/page-options)

### Accessibility
- [WCAG 2.1 Target Size (AAA)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [WCAG 2.2 Target Size Minimum (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [ARIA Live Regions (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [Accessible Form Validation (Smashing Magazine)](https://www.smashingmagazine.com/2023/02/guide-accessible-form-validation/)

### Mobile UX
- [Better Form Inputs for Mobile (CSS-Tricks)](https://css-tricks.com/better-form-inputs-for-better-mobile-user-experiences/)
- [16px Prevents iOS Zoom (CSS-Tricks)](https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/)

### UX Research
- [Inline Validation UX (Smashing Magazine)](https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/)
- [Inline Validation Testing (Baymard Institute)](https://baymard.com/blog/inline-form-validation)
