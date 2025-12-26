# Accessible Form Patterns

WCAG 2.1/2.2 compliant form patterns for Superforms.

## Required ARIA Attributes

### aria-invalid

Mark invalid fields:

```svelte
<input
  aria-invalid={$errors.email ? 'true' : undefined}
/>
```

### aria-describedby

Link error message to input:

```svelte
<input
  id="email"
  aria-describedby={$errors.email ? 'email-error' : 'email-hint'}
/>
<span id="email-hint" class="hint">We'll never share your email</span>
{#if $errors.email}
  <span id="email-error" class="error">{$errors.email}</span>
{/if}
```

### aria-live

Announce dynamic errors:

```svelte
<!-- Polite: Non-urgent (field validation) -->
<span aria-live="polite">{$errors.email}</span>

<!-- Assertive: Urgent (form-level errors) -->
<div role="alert" aria-live="assertive">
  Form submission failed
</div>
```

## Error Summary Pattern

Always provide error summary for screen readers:

```svelte
{#if $allErrors.length > 0}
  <div
    role="alert"
    class="error-summary"
    tabindex="-1"
    id="error-summary"
  >
    <h2>Please fix {$allErrors.length} error{$allErrors.length > 1 ? 's' : ''}</h2>
    <ul>
      {#each $allErrors as error}
        <li>
          <a href="#{error.path}">{error.messages[0]}</a>
        </li>
      {/each}
    </ul>
  </div>
{/if}
```

**Focus management:** Set focus to error summary after failed submission.

## Complete Accessible Form

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';

  let { data } = $props();
  let errorSummaryRef = $state<HTMLElement | null>(null);

  const {
    form,
    errors,
    constraints,
    enhance,
    submitting,
    delayed,
    allErrors
  } = superForm(data.form, {
    validators: valibotClient(schema),
    autoFocusOnError: 'detect',
    scrollToError: 'smooth',
    onResult: ({ result }) => {
      // Focus error summary on failed submission
      if (result.type === 'failure' && errorSummaryRef) {
        errorSummaryRef.focus();
      }
    }
  });
</script>

<!-- Error Summary -->
{#if $allErrors.length > 0}
  <div
    bind:this={errorSummaryRef}
    role="alert"
    class="error-summary"
    tabindex="-1"
  >
    <h2 id="error-heading">
      There {$allErrors.length === 1 ? 'is 1 error' : `are ${$allErrors.length} errors`}
    </h2>
    <ul aria-labelledby="error-heading">
      {#each $allErrors as error}
        <li>
          <a href="#{error.path}">{error.messages[0]}</a>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<form method="POST" use:enhance novalidate>
  <!-- Email Field -->
  <div class="field">
    <label for="email">
      Email
      <span aria-hidden="true" class="required">*</span>
      <span class="visually-hidden">(required)</span>
    </label>
    <input
      id="email"
      name="email"
      type="email"
      autocomplete="email"
      bind:value={$form.email}
      aria-required="true"
      aria-invalid={$errors.email ? 'true' : undefined}
      aria-describedby="email-hint{$errors.email ? ' email-error' : ''}"
      {...$constraints.email}
    />
    <span id="email-hint" class="hint">
      Enter your work email address
    </span>
    {#if $errors.email}
      <span id="email-error" class="error" role="status">
        <span aria-hidden="true">⚠</span>
        {$errors.email}
      </span>
    {/if}
  </div>

  <!-- Password Field -->
  <div class="field">
    <label for="password">
      Password
      <span aria-hidden="true" class="required">*</span>
      <span class="visually-hidden">(required)</span>
    </label>
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="new-password"
      bind:value={$form.password}
      aria-required="true"
      aria-invalid={$errors.password ? 'true' : undefined}
      aria-describedby="password-requirements{$errors.password ? ' password-error' : ''}"
      {...$constraints.password}
    />
    <ul id="password-requirements" class="hint">
      <li>At least 8 characters</li>
      <li>Include uppercase and lowercase letters</li>
      <li>Include at least one number</li>
    </ul>
    {#if $errors.password}
      <span id="password-error" class="error" role="status">
        <span aria-hidden="true">⚠</span>
        {$errors.password}
      </span>
    {/if}
  </div>

  <!-- Submit Button -->
  <button
    type="submit"
    disabled={$submitting}
    aria-disabled={$submitting}
  >
    {#if $delayed}
      <span class="spinner" aria-hidden="true"></span>
      <span class="visually-hidden">Submitting, please wait</span>
      <span aria-hidden="true">Submitting...</span>
    {:else}
      Create Account
    {/if}
  </button>
</form>

<style>
  /* Visually hidden but accessible to screen readers */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .error-summary {
    padding: 1rem;
    border: 2px solid #d32f2f;
    border-radius: 4px;
    background: #ffebee;
    margin-bottom: 1.5rem;
  }

  .error-summary:focus {
    outline: 3px solid #1976d2;
    outline-offset: 2px;
  }

  .error-summary h2 {
    color: #c62828;
    font-size: 1.125rem;
    margin: 0 0 0.5rem;
  }

  .error-summary ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .error-summary a {
    color: #c62828;
    text-decoration: underline;
  }

  .field {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .required {
    color: #d32f2f;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus {
    outline: 3px solid #1976d2;
    outline-offset: 2px;
    border-color: #1976d2;
  }

  input[aria-invalid="true"] {
    border-color: #d32f2f;
    border-width: 2px;
  }

  .hint {
    display: block;
    color: #666;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: #d32f2f;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    background: #1976d2;
    color: white;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #1565c0;
  }

  button:focus {
    outline: 3px solid #1976d2;
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
```

## Don't Rely on Color Alone

Always use multiple indicators:

```svelte
<!-- BAD: Color only -->
<input class={$errors.email ? 'border-red' : ''} />

<!-- GOOD: Color + icon + text -->
<input
  aria-invalid={$errors.email ? 'true' : undefined}
  class={$errors.email ? 'border-red border-2' : ''}
/>
{#if $errors.email}
  <span class="error">
    <svg aria-hidden="true"><!-- error icon --></svg>
    {$errors.email}
  </span>
{/if}
```

## Error Message Best Practices

### WCAG 3.3.3: Error Suggestion

Provide specific, actionable errors:

```typescript
// BAD
v.email('Invalid')

// GOOD
v.email('Enter a valid email like name@example.com')

// BAD
v.minLength(8)

// GOOD
v.minLength(8, 'Password must be at least 8 characters')
```

### Error Message Structure

```svelte
{#if $errors.email}
  <span id="email-error" class="error" role="status">
    <!-- Icon (hidden from screen readers) -->
    <svg aria-hidden="true" class="icon">...</svg>

    <!-- Error text -->
    <span>{$errors.email}</span>
  </span>
{/if}
```

## Autocomplete Attributes

Help users with autofill:

```svelte
<input name="name" autocomplete="name" />
<input name="email" autocomplete="email" />
<input name="tel" autocomplete="tel" />
<input name="street" autocomplete="street-address" />
<input name="city" autocomplete="address-level2" />
<input name="postal" autocomplete="postal-code" />
<input name="country" autocomplete="country" />
<input name="cc-number" autocomplete="cc-number" />
<input name="password" autocomplete="new-password" />
<input name="current-password" autocomplete="current-password" />
```

## Focus Management

### Superforms Config

```typescript
const { form, enhance } = superForm(data.form, {
  autoFocusOnError: 'detect',  // Skip on mobile
  scrollToError: 'smooth',
  stickyNavbar: '#header',     // Account for fixed header
  errorSelector: '[aria-invalid="true"]'
});
```

### Custom Focus Logic

```typescript
onResult: ({ result }) => {
  if (result.type === 'failure') {
    // Focus error summary
    document.getElementById('error-summary')?.focus();

    // Or focus first invalid field
    document.querySelector('[aria-invalid="true"]')?.focus();
  }
}
```

## Keyboard Navigation

Ensure all form controls are keyboard accessible:

```svelte
<button type="submit">Submit</button>  <!-- Focusable by default -->

<!-- Custom controls need tabindex -->
<div
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Custom Button
</div>
```

## Screen Reader Announcements

Use live regions for dynamic content:

```svelte
<!-- Status updates (polite) -->
<div role="status" aria-live="polite">
  {#if $message}
    {$message}
  {/if}
</div>

<!-- Errors (assertive) -->
<div role="alert" aria-live="assertive">
  {#if formError}
    {formError}
  {/if}
</div>
```

## Testing Accessibility

1. **Keyboard only:** Tab through entire form
2. **Screen reader:** Test with VoiceOver/NVDA
3. **Color contrast:** Check WCAG AA (4.5:1 for text)
4. **Focus indicators:** Visible focus ring on all interactive elements
5. **Error announcement:** Errors read aloud when they appear
