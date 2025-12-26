# Superforms Configuration

All options for `superForm()`.

## Basic Usage

```typescript
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';

const { form, errors, enhance, ...rest } = superForm(data.form, {
  // options
});
```

## Validation Options

### validators

Client-side validation adapter:

```typescript
validators: valibotClient(schema)
```

### validationMethod

When to trigger validation:

```typescript
validationMethod: 'auto'         // Default: blur + submit
validationMethod: 'oninput'      // Every keystroke
validationMethod: 'onblur'       // When leaving field
validationMethod: 'submit-only'  // Only on submit
```

### defaultValidator

Default validation behavior:

```typescript
defaultValidator: 'keep'    // Keep existing errors (default)
defaultValidator: 'clear'   // Clear errors on valid input
```

## Data Type Options

### dataType

Enable nested data support:

```typescript
dataType: 'form'   // Default: standard form encoding
dataType: 'json'   // JSON encoding (requires JS + use:enhance)
```

**Note:** `dataType: 'json'` ignores `disabled` attribute - all `$form` data posts.

### jsonChunkSize

Split large JSON payloads:

```typescript
jsonChunkSize: 500000  // Bytes per chunk (default)
```

### multipleSubmits

Handle rapid submissions:

```typescript
multipleSubmits: 'prevent'  // Block until complete (default)
multipleSubmits: 'allow'    // Allow all
multipleSubmits: 'abort'    // Abort previous, start new
```

## Reset Options

### resetForm

Reset form after successful submission:

```typescript
resetForm: true    // Reset to defaults
resetForm: false   // Keep values (default)
```

### clearOnSubmit

What to clear when submitting:

```typescript
clearOnSubmit: 'errors-and-message'  // Default
clearOnSubmit: 'errors'
clearOnSubmit: 'message'
clearOnSubmit: 'none'
```

## Error Handling Options

### autoFocusOnError

Focus first invalid field:

```typescript
autoFocusOnError: true       // Always focus
autoFocusOnError: false      // Never focus
autoFocusOnError: 'detect'   // Skip on mobile (default)
```

### scrollToError

Scroll to first error:

```typescript
scrollToError: 'smooth'      // Smooth scroll
scrollToError: 'auto'        // Instant scroll
scrollToError: 'off'         // No scrolling
scrollToError: {             // ScrollIntoViewOptions
  behavior: 'smooth',
  block: 'center'
}
```

### stickyNavbar

Offset for fixed navigation:

```typescript
stickyNavbar: '#navbar'      // CSS selector
stickyNavbar: '.header'
```

### errorSelector

Selector for error elements:

```typescript
errorSelector: '[aria-invalid="true"],[data-invalid]'  // Default
```

### customValidity

Use browser validation tooltips:

```typescript
customValidity: false   // Use custom error display (default)
customValidity: true    // Use native browser tooltips
```

## Timing Options

### delayMs

Milliseconds before `$delayed` becomes true:

```typescript
delayMs: 500  // Default
```

### timeoutMs

Milliseconds before `$timeout` becomes true:

```typescript
timeoutMs: 8000  // Default
```

## SvelteKit Integration

### applyAction

Apply ActionResult to form:

```typescript
applyAction: true     // Apply result (default)
applyAction: false    // Don't apply
applyAction: 'never'  // Never apply, even on error
```

### invalidateAll

Invalidate load functions after success:

```typescript
invalidateAll: true         // Always invalidate (default)
invalidateAll: false        // Never invalidate
invalidateAll: 'pessimistic' // Only on form change
invalidateAll: 'force'      // Force invalidation
```

## Tainted (Dirty) Form Options

### taintedMessage

Warn when navigating from modified form:

```typescript
taintedMessage: false                              // No warning (default)
taintedMessage: true                               // Browser default message
taintedMessage: 'You have unsaved changes'         // Custom message
```

### warnings.duplicateId

Warn about duplicate form IDs:

```typescript
warnings: {
  duplicateId: true   // Default
}
```

## Events

### onSubmit

Before form submission:

```typescript
onSubmit: ({ formData, formElement, action, cancel, submitter }) => {
  // Modify formData
  formData.set('timestamp', Date.now().toString());

  // Cancel submission
  if (!valid) cancel();
}
```

### onResult

After server response:

```typescript
onResult: ({ result, formEl, cancel }) => {
  // result is ActionResult
  if (result.type === 'redirect') {
    // Handle redirect
  }

  // Cancel default handling
  cancel();
}
```

### onUpdate

After form state updates:

```typescript
onUpdate: ({ form, cancel }) => {
  // Best place for toast notifications
  if (form.message) {
    toast.success(form.message);
  }
}
```

### onError

Handle errors and exceptions:

```typescript
onError: ({ result, message }) => {
  // result.type is 'error'
  toast.error('Something went wrong');

  // Set custom message
  message.set({ type: 'error', text: result.error.message });
}
```

### onChange

When field value changes:

```typescript
onChange: (event) => {
  // event.path - field path
  // event.value - new value
  // event.target - input element
}
```

## Return Values

```typescript
const {
  // Stores
  form,           // Writable<FormData>
  errors,         // Readable<Errors>
  constraints,    // Readable<Constraints>
  message,        // Writable<Message>
  tainted,        // Readable<TaintedFields>
  submitting,     // Readable<boolean>
  delayed,        // Readable<boolean>
  timeout,        // Readable<boolean>
  posted,         // Readable<boolean>
  allErrors,      // Readable<Array<{path, messages}>>
  formId,         // Readable<string>

  // Actions
  enhance,        // Form action for use:enhance
  submit,         // Programmatic submit
  reset,          // Reset form to defaults
  restore,        // Restore snapshot
  capture,        // Capture snapshot

  // Methods
  validate,       // Validate specific field(s)
  validateForm,   // Validate entire form
  isTainted,      // Check if field/form is tainted
} = superForm(data.form, options);
```

## Programmatic Methods

### submit()

Submit form programmatically:

```typescript
const { submit } = superForm(data.form);

// Submit with current data
await submit();

// Submit to specific action
await submit({ action: '?/update' });
```

### reset()

Reset form to defaults:

```typescript
const { reset } = superForm(data.form);

// Reset entire form
reset();

// Reset with new data
reset({ data: { name: 'New Value' } });

// Keep certain fields
reset({ keepMessage: true });
```

### validate()

Validate specific field:

```typescript
const { validate } = superForm(data.form);

// Validate field
await validate('email');

// Validate and focus
await validate('email', { focusOnError: true });

// Validate without updating store
const result = await validate('email', { update: false });
```

### form.update()

Update form data programmatically:

```typescript
const { form } = superForm(data.form);

// Update without tainting
form.update(
  ($form) => {
    $form.items.push(newItem);
    return $form;
  },
  { taint: false }
);

// Taint options
{ taint: true }         // Mark as tainted (default)
{ taint: false }        // Don't taint
{ taint: 'untaint' }    // Remove taint from changed fields
{ taint: 'untaint-form' } // Remove taint from entire form
```

## Snapshots

Preserve form state during navigation:

```svelte
<script lang="ts">
  const { form, capture, restore } = superForm(data.form);

  // Must export at page level
  export const snapshot = { capture, restore };
</script>
```

## Flash Messages

Integration with sveltekit-flash-message:

```typescript
const { form, enhance } = superForm(data.form, {
  flashMessage: {
    module: import('sveltekit-flash-message/client'),
    onError: ({ result, flashMessage }) => {
      flashMessage.set({
        type: 'error',
        message: result.error.message
      });
    }
  },
  syncFlashMessage: true
});
```
