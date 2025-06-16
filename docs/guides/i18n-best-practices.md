# i18n (Internationalization) Best Practices

This document outlines best practices for implementing internationalization in the WaveMAX Affiliate Program to avoid common pitfalls and ensure maintainability.

## Critical Rule: Avoid Nested Elements in i18n

### ❌ The Problem

When an element with `data-i18n` attribute contains nested elements with IDs or dynamic content, the i18n translation process will **replace the entire content**, removing any nested elements.

**Bad Example:**
```html
<!-- This will BREAK - the span with id="userName" will be removed -->
<p data-i18n="welcome.message">Welcome, <span id="userName">Guest</span>!</p>
```

### ✅ The Solution

Keep dynamic content elements **separate** from translated text:

**Good Example:**
```html
<!-- Keep dynamic elements as siblings or separate the structure -->
<p>Welcome, <span id="userName">Guest</span>!</p>
```

Or use parameter interpolation:
```html
<p data-i18n="welcome.message" data-i18n-param-name="Guest">Welcome, {{name}}!</p>
```

## Best Practices

### 1. Apply i18n to the Smallest Possible Element

**Good:**
```html
<p>
  <span data-i18n="common.labels.email">Email</span>: 
  <span id="userEmail">user@example.com</span>
</p>
```

**Bad:**
```html
<p data-i18n="user.emailLabel">
  Email: <span id="userEmail">user@example.com</span>
</p>
```

### 2. Use Parameter Interpolation for Dynamic Content

When text contains dynamic values, use i18n parameters:

```html
<!-- In HTML -->
<p data-i18n="order.total" data-i18n-param-amount="100">Total: ${{amount}}</p>

<!-- In translation file -->
{
  "order": {
    "total": "Total: ${{amount}}"
  }
}
```

### 3. Preserve Interactive Elements

Event handlers and attributes are preserved when i18n updates text content:

```html
<!-- This is SAFE - onclick will be preserved -->
<button onclick="submitForm()" data-i18n="common.buttons.submit">Submit</button>
```

### 4. Handle Complex Structures

For complex structures with mixed static and dynamic content:

```html
<!-- Split into multiple elements -->
<div class="terms">
  <span data-i18n="register.agreeText">I agree to the</span>
  <a href="/terms" data-i18n="register.termsLink">Terms of Service</a>
  <span data-i18n="register.andText">and</span>
  <a href="/privacy" data-i18n="register.privacyLink">Privacy Policy</a>
</div>
```

### 5. Exclude Content from Translation

Use `data-i18n-exclude="true"` for content that should never be translated:

```html
<blockquote data-i18n-exclude="true">
  "This is a customer testimonial that should remain in the original language"
</blockquote>
```

### 6. Dynamic Content Updates

When updating content dynamically via JavaScript:

```javascript
// Update the element directly
document.getElementById('affiliateName').textContent = affiliate.name;

// If using i18n parameters, update them
if (window.i18n && window.i18n.updateParams) {
    window.i18n.updateParams({
        affiliateName: affiliate.name
    });
}
```

## Common Patterns

### Dynamic Pricing
```html
<div class="price">
  <span data-i18n="pricing.label">Price:</span>
  $<span id="dynamicPrice">0.00</span>
  <span data-i18n="pricing.perUnit">per item</span>
</div>
```

### User Information
```html
<div class="user-info">
  <span data-i18n="user.greeting">Hello,</span>
  <span id="userName">Guest</span>
</div>
```

### Form Labels with Dynamic Validation
```html
<label>
  <span data-i18n="form.email">Email</span>
  <span id="emailError" class="error"></span>
</label>
<input type="email" name="email">
```

## Testing i18n Implementation

1. **Test Dynamic Content**: Ensure IDs and dynamic elements persist after language changes
2. **Test Language Switching**: Verify all text updates correctly when switching languages
3. **Test Parameter Updates**: Confirm dynamic parameters update in translated text
4. **Test Event Handlers**: Verify onclick and other handlers still work after translation

## Debugging Tips

1. **Missing Elements**: If an element with an ID disappears, check if it's nested inside an element with `data-i18n`
2. **Console Logging**: The i18n.js library logs initialization and translation events
3. **Inspect DOM**: Use browser DevTools to verify element structure after translation

## Language Files Structure

Translation files are located in `/public/locales/[language]/common.json`:

```json
{
  "common": {
    "buttons": {
      "submit": "Submit",
      "cancel": "Cancel"
    }
  },
  "landing": {
    "hero": {
      "title": "Welcome to WaveMAX"
    }
  }
}
```

## Adding New Translations

1. Add the key to all language files (en, es, pt)
2. Use hierarchical structure for organization
3. Keep keys descriptive and consistent
4. Use parameters for dynamic content
5. Test in all supported languages

---

*Last Updated: 2025-01-07*