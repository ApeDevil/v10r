# Superforms + Valibot

Form validation with Valibot schemas and Superforms.

## Schema

```ts
// $lib/schemas/auth.ts
import * as v from 'valibot';

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.nonEmpty('Email required'), v.email('Invalid email')),
  password: v.pipe(v.string(), v.nonEmpty('Password required'), v.minLength(8, 'Min 8 chars'))
});

export type LoginInput = v.InferInput<typeof loginSchema>;
```

## Server

```ts
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
    if (!form.valid) return fail(400, { form });

    const { email, password } = form.data;
    try {
      await authenticateUser(email, password);
      return message(form, 'Login successful!');
    } catch (e) {
      return message(form, 'Invalid credentials', { status: 401 });
    }
  }
};
```

## Client

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { loginSchema } from '$lib/schemas/auth';

  let { data } = $props();

  const { form, errors, enhance, submitting, message } = superForm(data.form, {
    validators: valibotClient(loginSchema),
    delayMs: 300
  });
</script>

<form method="POST" use:enhance>
  {#if $message}<div class="alert">{$message}</div>{/if}

  <input name="email" bind:value={$form.email} aria-invalid={$errors.email ? 'true' : undefined} />
  {#if $errors.email}<span class="error">{$errors.email}</span>{/if}

  <input name="password" type="password" bind:value={$form.password} />
  {#if $errors.password}<span class="error">{$errors.password}</span>{/if}

  <button disabled={$submitting}>Login</button>
</form>
```

## Valibot Patterns

**Common validators**
```ts
import * as v from 'valibot';

const name = v.pipe(v.string(), v.nonEmpty('Required'), v.minLength(2), v.maxLength(50));
const email = v.pipe(v.string(), v.nonEmpty(), v.email());
const url = v.pipe(v.string(), v.url());
const age = v.pipe(v.number(), v.minValue(0), v.maxValue(150));
const role = v.picklist(['admin', 'user', 'guest']);
const theme = v.optional(v.picklist(['light', 'dark']), 'light');
```

**Nested objects**
```ts
const addressSchema = v.object({
  street: v.pipe(v.string(), v.nonEmpty()),
  city: v.pipe(v.string(), v.nonEmpty()),
  zip: v.pipe(v.string(), v.regex(/^\d{5}$/))
});

const userSchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  address: addressSchema,
  billingAddress: v.optional(addressSchema)
});
```

**Arrays**
```ts
const tagsSchema = v.pipe(
  v.array(v.pipe(v.string(), v.nonEmpty())),
  v.minLength(1, 'At least one tag'),
  v.maxLength(5, 'Max 5 tags')
);

const itemsSchema = v.array(v.object({
  name: v.pipe(v.string(), v.nonEmpty()),
  quantity: v.pipe(v.number(), v.minValue(1)),
  price: v.pipe(v.number(), v.minValue(0))
}));
```

**Custom validation**
```ts
const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8),
  v.regex(/[A-Z]/, 'Must contain uppercase'),
  v.regex(/[0-9]/, 'Must contain number')
);

const confirmPasswordSchema = v.object({
  password: passwordSchema,
  confirmPassword: v.string()
}, [
  v.forward(
    v.check(i => i.password === i.confirmPassword, 'Passwords must match'),
    ['confirmPassword']
  )
]);
```

## Superform Options

```ts
const { form, errors, enhance, submitting, delayed, message } = superForm(data.form, {
  validators: valibotClient(schema),
  validationMethod: 'auto',  // 'auto' | 'oninput' | 'onblur' | 'submit-only'
  delayMs: 300,
  timeoutMs: 8000,
  resetForm: true,
  onUpdated: ({ form }) => { /* After form update */ }
});
```

## Multi-Step Forms

```svelte
<script lang="ts">
  let step = $state(1);
  const { form, errors, enhance, validate } = superForm(data.form, {
    validators: valibotClient(schema)
  });

  async function nextStep() {
    const fieldsToValidate = step === 1 ? ['name', 'email'] : ['address'];
    const result = await validate(fieldsToValidate);
    if (result.valid) step++;
  }
</script>

<form method="POST" use:enhance>
  {#if step === 1}
    <input name="name" bind:value={$form.name} />
    <button type="button" onclick={nextStep}>Next</button>
  {:else}
    <input name="address" bind:value={$form.address} />
    <button>Submit</button>
  {/if}
</form>
```

## Error Patterns

**Field errors**
```svelte
<input
  name="email"
  bind:value={$form.email}
  aria-invalid={$errors.email ? 'true' : undefined}
  aria-describedby={$errors.email ? 'email-error' : undefined}
/>
{#if $errors.email}
  <span id="email-error" class="error">{$errors.email}</span>
{/if}
```

**Form-level errors**
```svelte
{#if $allErrors.length > 0}
  <div class="error-summary">
    <ul>
      {#each $allErrors as error}
        <li>{error.path}: {error.messages.join(', ')}</li>
      {/each}
    </ul>
  </div>
{/if}
```
