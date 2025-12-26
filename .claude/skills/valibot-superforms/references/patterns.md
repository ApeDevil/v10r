# Common Form Patterns

Reusable patterns for Superforms + Valibot.

## Authentication Forms

### Login Schema

```typescript
import * as v from 'valibot';

export const loginSchema = v.object({
  email: v.pipe(
    v.string('Email is required'),
    v.trim(),
    v.email('Invalid email address')
  ),
  password: v.pipe(
    v.string('Password is required'),
    v.minLength(1, 'Password is required')
  ),
  remember: v.optional(v.boolean(), false)
});
```

### Registration Schema

```typescript
export const registerSchema = v.pipe(
  v.object({
    name: v.pipe(
      v.string('Name is required'),
      v.trim(),
      v.minLength(2, 'Name must be at least 2 characters')
    ),
    email: v.pipe(
      v.string('Email is required'),
      v.trim(),
      v.toLowerCase(),
      v.email('Invalid email address')
    ),
    password: v.pipe(
      v.string('Password is required'),
      v.minLength(8, 'Password must be at least 8 characters'),
      v.regex(/[A-Z]/, 'Password must contain an uppercase letter'),
      v.regex(/[a-z]/, 'Password must contain a lowercase letter'),
      v.regex(/[0-9]/, 'Password must contain a number')
    ),
    confirmPassword: v.string('Please confirm your password')
  }),
  // Cross-field validation
  v.forward(
    v.check(
      (data) => data.password === data.confirmPassword,
      'Passwords do not match'
    ),
    ['confirmPassword']
  )
);
```

## Contact Form

```typescript
export const contactSchema = v.object({
  name: v.pipe(
    v.string('Name is required'),
    v.trim(),
    v.minLength(2, 'Name is too short'),
    v.maxLength(100, 'Name is too long')
  ),
  email: v.pipe(
    v.string('Email is required'),
    v.trim(),
    v.email('Invalid email address')
  ),
  subject: v.pipe(
    v.string('Subject is required'),
    v.trim(),
    v.minLength(5, 'Subject is too short'),
    v.maxLength(200, 'Subject is too long')
  ),
  message: v.pipe(
    v.string('Message is required'),
    v.trim(),
    v.minLength(20, 'Message must be at least 20 characters'),
    v.maxLength(5000, 'Message is too long')
  ),
  category: v.picklist(
    ['general', 'support', 'sales', 'feedback'],
    'Please select a category'
  )
});
```

## Profile Settings

```typescript
export const profileSchema = v.object({
  displayName: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, 'Display name must be at least 2 characters'),
    v.maxLength(50, 'Display name is too long')
  ),
  bio: v.pipe(
    v.optional(v.string(), ''),
    v.maxLength(500, 'Bio is too long')
  ),
  website: v.pipe(
    v.optional(v.string(), ''),
    v.trim(),
    v.check(
      (url) => url === '' || /^https?:\/\/.+/.test(url),
      'Invalid URL (must start with http:// or https://)'
    )
  ),
  notifications: v.object({
    email: v.optional(v.boolean(), true),
    push: v.optional(v.boolean(), false),
    sms: v.optional(v.boolean(), false)
  })
});
```

## Multi-Step Form

### Schema with Partials

```typescript
// Step 1: Personal Info
export const step1Schema = v.object({
  firstName: v.pipe(v.string(), v.minLength(2)),
  lastName: v.pipe(v.string(), v.minLength(2)),
  email: v.pipe(v.string(), v.email())
});

// Step 2: Address
export const step2Schema = v.object({
  street: v.pipe(v.string(), v.minLength(5)),
  city: v.pipe(v.string(), v.minLength(2)),
  zipCode: v.pipe(v.string(), v.regex(/^\d{5}$/))
});

// Step 3: Preferences
export const step3Schema = v.object({
  plan: v.picklist(['basic', 'pro', 'enterprise']),
  terms: v.pipe(
    v.boolean(),
    v.check((v) => v === true, 'You must accept the terms')
  )
});

// Full schema for final submission
export const fullSchema = v.object({
  ...step1Schema.entries,
  ...step2Schema.entries,
  ...step3Schema.entries
});
```

### Multi-Step Component

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';

  let { data } = $props();
  let step = $state(1);

  const schemas = [step1Schema, step2Schema, step3Schema];

  const { form, errors, enhance, validateForm } = superForm(data.form, {
    validators: valibotClient(fullSchema),
    validationMethod: 'submit-only'
  });

  async function nextStep() {
    // Validate current step fields only
    const result = await validateForm({ update: true });

    const currentFields = Object.keys(schemas[step - 1].entries);
    const hasErrors = currentFields.some(
      (field) => $errors[field as keyof typeof $errors]
    );

    if (!hasErrors) {
      step++;
    }
  }

  function prevStep() {
    step--;
  }
</script>

<form method="POST" use:enhance>
  {#if step === 1}
    <h2>Personal Information</h2>
    <input bind:value={$form.firstName} />
    <input bind:value={$form.lastName} />
    <input bind:value={$form.email} type="email" />
    <button type="button" onclick={nextStep}>Next</button>

  {:else if step === 2}
    <h2>Address</h2>
    <input bind:value={$form.street} />
    <input bind:value={$form.city} />
    <input bind:value={$form.zipCode} />
    <button type="button" onclick={prevStep}>Back</button>
    <button type="button" onclick={nextStep}>Next</button>

  {:else if step === 3}
    <h2>Plan Selection</h2>
    <select bind:value={$form.plan}>
      <option value="basic">Basic</option>
      <option value="pro">Pro</option>
      <option value="enterprise">Enterprise</option>
    </select>
    <label>
      <input type="checkbox" bind:checked={$form.terms} />
      I accept the terms
    </label>
    <button type="button" onclick={prevStep}>Back</button>
    <button type="submit">Submit</button>
  {/if}
</form>
```

## Search with Filters

```typescript
export const searchSchema = v.object({
  query: v.optional(v.pipe(v.string(), v.trim()), ''),
  category: v.optional(v.picklist(['all', 'products', 'articles', 'users']), 'all'),
  sortBy: v.optional(v.picklist(['relevance', 'date', 'popularity']), 'relevance'),
  sortOrder: v.optional(v.picklist(['asc', 'desc']), 'desc'),
  minPrice: v.optional(v.pipe(v.number(), v.minValue(0))),
  maxPrice: v.optional(v.pipe(v.number(), v.maxValue(100000))),
  inStock: v.optional(v.boolean(), false)
});
```

### Search Form with URL Sync

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { superForm } from 'sveltekit-superforms';

  let { data } = $props();

  const { form, enhance } = superForm(data.form, {
    onUpdate: ({ form }) => {
      // Sync to URL without navigation
      const params = new URLSearchParams();
      Object.entries(form.data).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
    }
  });
</script>
```

## Toast Notifications

```typescript
const { form, enhance } = superForm(data.form, {
  onUpdate: ({ form }) => {
    if (form.valid && form.message) {
      toast.success(form.message);
    }
  },
  onError: ({ result }) => {
    toast.error(result.error?.message ?? 'Something went wrong');
  }
});
```

## Optimistic Updates

```svelte
<script lang="ts">
  let optimisticItems = $state<Item[]>([]);

  const { form, enhance } = superForm(data.form, {
    onSubmit: ({ formData }) => {
      // Add optimistic item
      const name = formData.get('name') as string;
      optimisticItems = [...optimisticItems, { id: 'temp', name, pending: true }];
    },
    onResult: ({ result }) => {
      if (result.type === 'success') {
        // Clear optimistic, real data comes from load
        optimisticItems = [];
      } else {
        // Remove failed optimistic item
        optimisticItems = optimisticItems.filter((i) => i.id !== 'temp');
        toast.error('Failed to add item');
      }
    }
  });

  let allItems = $derived([...data.items, ...optimisticItems]);
</script>
```

## Debounced Validation

For expensive validations (API calls, etc.):

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils';

  const { form, validate } = superForm(data.form, {
    validationMethod: 'submit-only'  // Disable auto validation
  });

  // Debounced validation for username availability
  const checkUsername = debounce(async () => {
    await validate('username');
  }, 500);
</script>

<input
  bind:value={$form.username}
  oninput={checkUsername}
/>
```

## Conditional Fields

```svelte
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form);

  let showCompanyFields = $derived($form.accountType === 'business');
</script>

<form method="POST" use:enhance>
  <select bind:value={$form.accountType}>
    <option value="personal">Personal</option>
    <option value="business">Business</option>
  </select>

  {#if showCompanyFields}
    <input
      name="companyName"
      bind:value={$form.companyName}
      placeholder="Company Name"
    />
    <input
      name="taxId"
      bind:value={$form.taxId}
      placeholder="Tax ID"
    />
  {/if}

  <button>Submit</button>
</form>
```

### Schema with Conditional Validation

```typescript
export const accountSchema = v.pipe(
  v.object({
    accountType: v.picklist(['personal', 'business']),
    name: v.pipe(v.string(), v.minLength(2)),
    companyName: v.optional(v.string()),
    taxId: v.optional(v.string())
  }),
  v.forward(
    v.check((data) => {
      if (data.accountType === 'business') {
        return !!data.companyName && data.companyName.length >= 2;
      }
      return true;
    }, 'Company name is required for business accounts'),
    ['companyName']
  ),
  v.forward(
    v.check((data) => {
      if (data.accountType === 'business') {
        return !!data.taxId && /^\d{9}$/.test(data.taxId);
      }
      return true;
    }, 'Valid Tax ID is required for business accounts'),
    ['taxId']
  )
);
```

## Form Reset Patterns

### Reset to Initial Values

```svelte
<script lang="ts">
  const { form, reset } = superForm(data.form);
</script>

<button type="button" onclick={() => reset()}>
  Reset Form
</button>
```

### Reset with New Data

```typescript
reset({
  data: { name: 'New Default', email: '' }
});
```

### Reset Keeping Message

```typescript
reset({ keepMessage: true });
```

## Multiple Forms on Same Page

```svelte
<script lang="ts">
  const loginForm = superForm(data.loginForm, {
    id: 'login'
  });

  const registerForm = superForm(data.registerForm, {
    id: 'register'
  });
</script>

<form method="POST" action="?/login" use:enhance={loginForm.enhance}>
  <input type="hidden" name="__superform_id" bind:value={loginForm.formId} />
  <!-- Login fields -->
</form>

<form method="POST" action="?/register" use:enhance={registerForm.enhance}>
  <input type="hidden" name="__superform_id" bind:value={registerForm.formId} />
  <!-- Register fields -->
</form>
```
