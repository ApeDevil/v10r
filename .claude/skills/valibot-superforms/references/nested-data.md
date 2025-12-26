# Nested Data and File Uploads

Handling complex form structures with Superforms.

## Enable Nested Data

```typescript
const { form, enhance } = superForm(data.form, {
  dataType: 'json'  // Required for nested objects
});
```

**Requirements:**
- JavaScript must be enabled
- Must use `use:enhance`
- `disabled` attribute is ignored (all `$form` data posts)

## Nested Objects

### Schema

```typescript
import * as v from 'valibot';

const schema = v.object({
  user: v.object({
    name: v.string(),
    address: v.object({
      street: v.string(),
      city: v.string(),
      zip: v.pipe(v.string(), v.regex(/^\d{5}$/))
    })
  })
});
```

### Form

```svelte
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form, {
    dataType: 'json'
  });
</script>

<form method="POST" use:enhance>
  <input name="user.name" bind:value={$form.user.name} />
  {#if $errors.user?.name}
    <span class="error">{$errors.user.name}</span>
  {/if}

  <input name="user.address.street" bind:value={$form.user.address.street} />
  {#if $errors.user?.address?.street}
    <span class="error">{$errors.user.address.street}</span>
  {/if}

  <input name="user.address.city" bind:value={$form.user.address.city} />
  {#if $errors.user?.address?.city}
    <span class="error">{$errors.user.address.city}</span>
  {/if}

  <input name="user.address.zip" bind:value={$form.user.address.zip} />
  {#if $errors.user?.address?.zip}
    <span class="error">{$errors.user.address.zip}</span>
  {/if}

  <button>Submit</button>
</form>
```

## Arrays

### Schema

```typescript
const schema = v.object({
  tags: v.array(v.pipe(v.string(), v.minLength(1)))
});
```

### Simple Array (No dataType: 'json' needed)

```svelte
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form);
</script>

<form method="POST" use:enhance>
  {#each $form.tags as _, i}
    <div class="tag-row">
      <input
        name="tags"
        bind:value={$form.tags[i]}
        aria-invalid={$errors.tags?.[i] ? 'true' : undefined}
      />
      {#if $errors.tags?.[i]}
        <span class="error">{$errors.tags[i]}</span>
      {/if}
      <button type="button" onclick={() => removeTag(i)}>Remove</button>
    </div>
  {/each}

  <!-- Array-level errors -->
  {#if $errors.tags?._errors}
    <span class="error">{$errors.tags._errors}</span>
  {/if}

  <button type="button" onclick={addTag}>Add Tag</button>
  <button>Submit</button>
</form>

<script lang="ts">
  function addTag() {
    $form.tags = [...$form.tags, ''];
  }

  function removeTag(index: number) {
    $form.tags = $form.tags.filter((_, i) => i !== index);
  }
</script>
```

## Arrays of Objects

### Schema

```typescript
const schema = v.object({
  posts: v.array(v.object({
    title: v.pipe(v.string(), v.minLength(3)),
    content: v.string(),
    published: v.boolean()
  }))
});
```

### Form (Requires dataType: 'json')

```svelte
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form, {
    dataType: 'json'
  });

  function addPost() {
    form.update(($form) => {
      $form.posts = [...$form.posts, { title: '', content: '', published: false }];
      return $form;
    }, { taint: false });
  }

  function removePost(index: number) {
    form.update(($form) => {
      $form.posts = $form.posts.filter((_, i) => i !== index);
      return $form;
    }, { taint: false });
  }
</script>

<form method="POST" use:enhance>
  {#each $form.posts as post, i}
    <fieldset>
      <legend>Post {i + 1}</legend>

      <label for="post-{i}-title">Title</label>
      <input
        id="post-{i}-title"
        bind:value={$form.posts[i].title}
        aria-invalid={$errors.posts?.[i]?.title ? 'true' : undefined}
      />
      {#if $errors.posts?.[i]?.title}
        <span class="error">{$errors.posts[i].title}</span>
      {/if}

      <label for="post-{i}-content">Content</label>
      <textarea
        id="post-{i}-content"
        bind:value={$form.posts[i].content}
        aria-invalid={$errors.posts?.[i]?.content ? 'true' : undefined}
      ></textarea>
      {#if $errors.posts?.[i]?.content}
        <span class="error">{$errors.posts[i].content}</span>
      {/if}

      <label>
        <input
          type="checkbox"
          bind:checked={$form.posts[i].published}
        />
        Published
      </label>

      <button type="button" onclick={() => removePost(i)}>
        Remove Post
      </button>
    </fieldset>
  {/each}

  <!-- Array-level errors -->
  {#if $errors.posts?._errors}
    <span class="error">{$errors.posts._errors}</span>
  {/if}

  <button type="button" onclick={addPost}>Add Post</button>
  <button>Submit</button>
</form>
```

## Programmatic Updates

### Without Tainting

```typescript
// Add item without marking form as "dirty"
form.update(
  ($form) => {
    $form.items.push({ name: '', quantity: 1 });
    return $form;
  },
  { taint: false }
);
```

### Taint Options

```typescript
{ taint: true }           // Mark as tainted (default for user input)
{ taint: false }          // Don't mark as tainted
{ taint: 'untaint' }      // Remove taint from modified fields
{ taint: 'untaint-form' } // Remove taint from entire form
```

## File Uploads

### Schema (Custom Validation)

Valibot v1 doesn't have built-in File schema. Use custom validation:

```typescript
import * as v from 'valibot';

const fileSchema = v.pipe(
  v.instance(File),
  v.check((f) => f.size <= 5 * 1024 * 1024, 'Max 5MB'),
  v.check((f) => f.type.startsWith('image/'), 'Must be image')
);

const schema = v.object({
  avatar: v.optional(fileSchema),
  documents: v.optional(v.array(fileSchema))
});
```

### Single File Upload

```svelte
<script lang="ts">
  import { superForm, fileProxy } from 'sveltekit-superforms';

  let { data } = $props();

  const { form, errors, enhance } = superForm(data.form);

  // File proxy syncs file input with form
  const avatar = fileProxy(form, 'avatar');
</script>

<form method="POST" enctype="multipart/form-data" use:enhance>
  <label for="avatar">Avatar</label>
  <input
    id="avatar"
    name="avatar"
    type="file"
    accept="image/*"
    bind:files={$avatar}
    aria-invalid={$errors.avatar ? 'true' : undefined}
  />
  {#if $errors.avatar}
    <span class="error">{$errors.avatar}</span>
  {/if}

  <button>Upload</button>
</form>
```

### Multiple Files

```svelte
<script lang="ts">
  import { superForm, filesProxy } from 'sveltekit-superforms';

  let { data } = $props();

  const { form, errors, enhance } = superForm(data.form);

  // Note: filesProxy (plural) for multiple files
  const documents = filesProxy(form, 'documents');
</script>

<form method="POST" enctype="multipart/form-data" use:enhance>
  <label for="documents">Documents</label>
  <input
    id="documents"
    name="documents"
    type="file"
    multiple
    accept=".pdf,.doc,.docx"
    bind:files={$documents}
    aria-invalid={$errors.documents ? 'true' : undefined}
  />
  {#if $errors.documents}
    <span class="error">{$errors.documents}</span>
  {/if}

  <button>Upload</button>
</form>
```

### Server-Side File Handling

```typescript
import { superValidate, fail, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));

    if (!form.valid) {
      // MUST use Superforms' fail() for file uploads
      return fail(400, { form });
    }

    const file = form.data.avatar;
    if (file) {
      const buffer = await file.arrayBuffer();
      // Save file...
    }

    return message(form, 'Uploaded successfully!');
  }
};
```

**Important:** For file uploads, you MUST use Superforms' `fail()`, `message()`, or `setError()`. SvelteKit's native `fail()` won't work correctly.

### With SvelteKit's fail()

If you must use SvelteKit's `fail()`, use `withFiles()`:

```typescript
import { fail } from '@sveltejs/kit';
import { superValidate, withFiles } from 'sveltekit-superforms';

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));

    if (!form.valid) {
      return fail(400, withFiles({ form }));
    }

    // ...
  }
};
```

## File Preview

```svelte
<script lang="ts">
  const avatar = fileProxy(form, 'avatar');

  let preview = $derived.by(() => {
    const file = $avatar?.[0];
    return file ? URL.createObjectURL(file) : null;
  });

  $effect(() => {
    // Cleanup URL on unmount or change
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  });
</script>

{#if preview}
  <img src={preview} alt="Preview" />
{/if}

<input type="file" bind:files={$avatar} />
```

## Validation Errors Structure

```typescript
// For nested data, errors mirror the structure:

$errors.user?.name           // string field error
$errors.user?.address?.city  // nested object field error
$errors.tags?.[0]            // array element error
$errors.tags?._errors        // array-level error
$errors.posts?.[0]?.title    // array of objects field error
$errors.posts?._errors       // array-level error
$errors._errors              // form-level error (schema refinements)
```

## Server-Side Nested Errors

```typescript
import { setError } from 'sveltekit-superforms';

// Field in nested object
return setError(form, 'user.address.city', 'Invalid city');

// Array element
return setError(form, 'tags[0]', 'Invalid tag');

// Field in array of objects
return setError(form, 'posts[2].title', 'Title too short');

// Array-level error
return setError(form, 'posts', 'Maximum 10 posts allowed');
```
