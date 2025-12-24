# Forms Architecture

Type-safe forms with real-time validation using Superforms and Valibot.

---

## Strategy

**Superforms + Valibot** for the complete form lifecycle.

| Component | Choice | Why |
|-----------|--------|-----|
| Form library | Superforms v2 | SvelteKit-native, progressive enhancement |
| Validation | Valibot | Smaller than Zod, tree-shakeable, fast |
| Enhancement | `use:enhance` | No full-page reloads |
| Feedback | Inline + Toast | Context-dependent error display |

### Why Valibot over Zod

| Feature | Valibot | Zod |
|---------|---------|-----|
| Bundle size | ~1KB per schema | ~12KB base |
| Tree-shaking | Full | Partial |
| Performance | Faster validation | Slower |
| API | Pipe-based | Chained |

### Exception: Auth Forms

Authentication forms (login, register, password reset) use Better Auth's client methods directly, not Superforms. See [auth.md](./auth.md#authentication-flows) for details.

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

export const loginSchema = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty('Email is required'),
    v.email('Invalid email address')
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty('Password is required'),
    v.minLength(8, 'Password must be at least 8 characters')
  ),
});

export const registerSchema = v.object({
  name: v.pipe(
    v.string(),
    v.nonEmpty('Name is required'),
    v.minLength(2, 'Name must be at least 2 characters')
  ),
  email: v.pipe(
    v.string(),
    v.nonEmpty('Email is required'),
    v.email('Invalid email address')
  ),
  password: v.pipe(
    v.string(),
    v.nonEmpty('Password is required'),
    v.minLength(8, 'Password must be at least 8 characters'),
    v.regex(/[A-Z]/, 'Password must contain an uppercase letter'),
    v.regex(/[0-9]/, 'Password must contain a number')
  ),
  confirmPassword: v.string(),
}, [
  // Cross-field validation
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'Passwords do not match'
    ),
    ['confirmPassword']
  ),
]);

export type LoginSchema = v.InferInput<typeof loginSchema>;
export type RegisterSchema = v.InferInput<typeof registerSchema>;
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
// src/routes/auth/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth';
import { auth } from '$lib/server/auth';

// Schema at top level for caching
export async function load() {
  const form = await superValidate(valibot(loginSchema));
  return { form };
}

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await superValidate(request, valibot(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Authenticate
    const result = await auth.api.signInEmail({
      body: {
        email: form.data.email,
        password: form.data.password,
      },
    });

    if (result.error) {
      return message(form, 'Invalid email or password', { status: 401 });
    }

    redirect(303, '/app/dashboard');
  },
};
```

### Named Actions

```typescript
// src/routes/auth/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { loginSchema, registerSchema } from '$lib/schemas/auth';

export async function load() {
  return {
    loginForm: await superValidate(valibot(loginSchema)),
    registerForm: await superValidate(valibot(registerSchema)),
  };
}

export const actions = {
  login: async ({ request }) => {
    const form = await superValidate(request, valibot(loginSchema));
    if (!form.valid) return fail(400, { form });
    // ... authenticate
    redirect(303, '/app/dashboard');
  },

  register: async ({ request }) => {
    const form = await superValidate(request, valibot(registerSchema));
    if (!form.valid) return fail(400, { form });
    // ... create account
    redirect(303, '/app/dashboard');
  },
};
```

---

## Client Integration

### Basic Form

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { loginSchema } from '$lib/schemas/auth';
  import { toast } from '$lib/stores/toast.svelte';

  let { data } = $props();

  const { form, errors, enhance, submitting, message } = superForm(data.form, {
    validators: valibotClient(loginSchema),

    // Real-time validation with debounce
    validationMethod: 'oninput',
    delayMs: 300,

    // Error handling
    onError({ result }) {
      toast.error(result.error.message || 'Something went wrong');
    },

    // Success handling
    onResult({ result }) {
      if (result.type === 'redirect') {
        toast.success('Welcome back!');
      }
    },
  });
</script>

<form method="POST" use:enhance>
  <div class="form-field">
    <label for="email">Email</label>
    <input
      id="email"
      name="email"
      type="email"
      bind:value={$form.email}
      aria-invalid={$errors.email ? 'true' : undefined}
      aria-describedby={$errors.email ? 'email-error' : undefined}
    />
    {#if $errors.email}
      <span id="email-error" class="error">{$errors.email}</span>
    {/if}
  </div>

  <div class="form-field">
    <label for="password">Password</label>
    <input
      id="password"
      name="password"
      type="password"
      bind:value={$form.password}
      aria-invalid={$errors.password ? 'true' : undefined}
    />
    {#if $errors.password}
      <span class="error">{$errors.password}</span>
    {/if}
  </div>

  {#if $message}
    <div class="form-error" role="alert">{$message}</div>
  {/if}

  <button type="submit" disabled={$submitting}>
    {$submitting ? 'Signing in...' : 'Sign In'}
  </button>
</form>
```

### Validation Timing

```typescript
const { form, enhance } = superForm(data.form, {
  validators: valibotClient(schema),

  // Options for validation timing:
  validationMethod: 'oninput',  // Real-time (on every keystroke)
  // validationMethod: 'onblur', // When field loses focus
  // validationMethod: 'submit-only', // Only on submit

  delayMs: 300, // Debounce delay for 'oninput'
});
```

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
| Auth errors (wrong password) | Form-level message |
| Server errors (500) | Toast notification |
| Success feedback | Toast notification |
| Multi-step wizard | Summary at step top |

---

## Form Patterns

### Settings Form (Multi-Section)

```svelte
<!-- src/routes/app/settings/+page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { settingsSchema } from '$lib/schemas/user';

  let { data } = $props();

  const { form, errors, enhance, submitting, tainted } = superForm(data.form, {
    validators: valibotClient(settingsSchema),
    validationMethod: 'oninput',
    delayMs: 300,
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
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { step1Schema, step2Schema, step3Schema } from '$lib/schemas/wizard';

  let { data } = $props();
  let currentStep = $state(1);

  const schemas = [step1Schema, step2Schema, step3Schema];

  const { form, errors, enhance, validate } = superForm(data.form, {
    validators: valibotClient(schemas[currentStep - 1]),
    validationMethod: 'oninput',
    delayMs: 300,
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
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();

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
  import { superForm } from 'sveltekit-superforms';
  import { ConfirmDialog } from '$lib/components/composites';

  let { data } = $props();
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

export async function load() {
  const form = await superValidate(valibot(avatarSchema));
  return { form };
}

export const actions = {
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
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();
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

## File Structure

```
src/
├── lib/
│   └── schemas/
│       ├── auth.ts           # Login, register, reset-password
│       ├── user.ts           # Profile, settings
│       ├── address.ts        # Nested address object
│       ├── wizard.ts         # Multi-step form schemas
│       └── index.ts          # Barrel export
└── routes/
    ├── auth/
    │   ├── login/
    │   │   ├── +page.svelte
    │   │   └── +page.server.ts
    │   ├── register/
    │   └── forgot-password/
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
| Validation | Valibot schemas |
| Timing | Real-time with 300ms debounce |
| Errors | Inline + form message + toast |
| Enhancement | `use:enhance` for no-reload |
| Files | `withFiles()` + Sharp + R2 |

---

## Related

- [design/components.md](./design/components.md) - Form field components (Input, Select, FormField)
- [design/tokens.md](./design/tokens.md) - Design tokens for form styling
- [auth.md](./auth.md) - Login/register form implementations
- [error-handling.md](./error-handling.md) - Error display patterns
- [pages.md](./pages.md) - `/showcase/forms` route

---

## Sources

- [Superforms Documentation](https://superforms.rocks/)
- [Valibot Documentation](https://valibot.dev/)
- [SvelteKit Form Actions](https://svelte.dev/docs/kit/form-actions)
- [Superforms GitHub](https://github.com/ciscoheat/sveltekit-superforms)
