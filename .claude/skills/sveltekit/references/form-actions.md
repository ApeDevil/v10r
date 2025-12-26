# Form Actions

## Basic Actions

```typescript
// +page.server.js
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  // Default action (no ?/name needed)
  default: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Validation
    if (!email) {
      return fail(400, { email, missing: true });
    }

    // Business logic
    const user = await authenticate(email, password);
    if (!user) {
      return fail(401, { email, incorrect: true });
    }

    // Set session
    cookies.set('session', user.sessionId, { path: '/' });

    // Redirect on success (no throw in v2)
    redirect(303, '/dashboard');
  }
};
```

## Named Actions

```typescript
export const actions: Actions = {
  login: async ({ request }) => {
    // Handle login
  },

  register: async ({ request }) => {
    // Handle registration
  },

  logout: async ({ cookies }) => {
    cookies.delete('session', { path: '/' });
    redirect(303, '/');
  }
};
```

```svelte
<form method="POST" action="?/login">
  <!-- login form -->
</form>

<form method="POST" action="?/register">
  <!-- register form -->
</form>

<form method="POST" action="?/logout">
  <button>Logout</button>
</form>
```

## Progressive Enhancement

### Basic enhance

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<form method="POST" use:enhance>
  <input name="email" type="email" required />
  <button>Submit</button>
</form>
```

Benefits:
- No full page reload
- Updates `page.form` and `page.status`
- Falls back to regular form if JS disabled

### Custom enhance

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';

  let submitting = $state(false);
</script>

<form
  method="POST"
  use:enhance={({ formData, formElement, action, cancel, submitter }) => {
    // Before submission
    submitting = true;

    // Optional: modify formData
    formData.set('timestamp', Date.now().toString());

    // Optional: cancel submission
    if (!confirm('Are you sure?')) {
      cancel();
      submitting = false;
      return;
    }

    return async ({ result, update }) => {
      // After response
      submitting = false;

      if (result.type === 'success') {
        // Custom success handling
        toast.success('Saved!');
      }

      if (result.type === 'failure') {
        // Custom error handling
        toast.error(result.data?.message ?? 'Failed');
      }

      // Apply default behavior (update page.form, etc.)
      await update();

      // Or use applyAction for more control
      // await applyAction(result);
    };
  }}
>
  <button disabled={submitting}>
    {submitting ? 'Saving...' : 'Save'}
  </button>
</form>
```

## Displaying Errors

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';

  let { form } = $props(); // ActionData from props
</script>

<form method="POST" use:enhance>
  <label>
    Email
    <input
      name="email"
      type="email"
      value={form?.email ?? ''}
      aria-invalid={form?.errors?.email ? 'true' : undefined}
    />
    {#if form?.errors?.email}
      <span class="error">{form.errors.email}</span>
    {/if}
  </label>

  {#if form?.message}
    <div class="form-error">{form.message}</div>
  {/if}

  <button>Submit</button>
</form>
```

## With Valibot + Superforms

```typescript
// +page.server.js
import { superValidate, fail } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';

const schema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8))
});

export const load = async () => {
  const form = await superValidate(valibot(schema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));

    if (!form.valid) {
      return fail(400, { form });
    }

    // Process valid data
    await createUser(form.data);

    return { form };
  }
};
```

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';

  let { data } = $props();

  const { form, errors, enhance, submitting } = superForm(data.form, {
    validators: valibotClient(schema)
  });
</script>

<form method="POST" use:enhance>
  <input name="email" bind:value={$form.email} />
  {#if $errors.email}<span class="error">{$errors.email}</span>{/if}

  <input name="password" type="password" bind:value={$form.password} />
  {#if $errors.password}<span class="error">{$errors.password}</span>{/if}

  <button disabled={$submitting}>
    {$submitting ? 'Submitting...' : 'Submit'}
  </button>
</form>
```

## File Uploads

```typescript
export const actions: Actions = {
  upload: async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      return fail(400, { message: 'No file uploaded' });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return fail(400, { message: 'Must be an image' });
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return fail(400, { message: 'File too large' });
    }

    // Save file
    const buffer = await file.arrayBuffer();
    await saveFile(file.name, buffer);

    return { success: true };
  }
};
```

```svelte
<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
  <input type="file" name="file" accept="image/*" />
  <button>Upload</button>
</form>
```

**New in SvelteKit 2.49:** File uploads can be streamed in form remote functions.

## Cross-Page Actions

When action is on different page, `page.form` is NOT updated:

```svelte
<!-- This form posts to /api/subscribe -->
<form method="POST" action="/api/subscribe" use:enhance={({ formElement }) => {
  return async ({ result }) => {
    if (result.type === 'redirect') {
      // Handle redirect manually
      goto(result.location);
    }
  };
}}>
  <input name="email" />
  <button>Subscribe</button>
</form>
```

## Cookie Path Required (v2)

```typescript
// v1 - path optional
cookies.set('session', value);
cookies.delete('session');

// v2 - path required
cookies.set('session', value, { path: '/' });
cookies.delete('session', { path: '/' });
```

## Prerendering Constraint

Pages with form actions CANNOT be prerendered:

```typescript
// This will fail
export const prerender = true;

export const actions = {
  default: async () => { /* ... */ }
};
```

Either remove `prerender = true` or move action to API route.
