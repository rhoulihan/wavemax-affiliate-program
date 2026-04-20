# WaveMAX — Common Pitfalls

Quick-reference guide to mistakes we've hit before. Each entry shows the trap and the fix.

---

## 1. Hardcoding Business Values

Business rates live in `SystemConfig`, not in code.

Bad:
```javascript
const wdfRate = 1.25;
const deliveryFee = 25;
```

Good:
```javascript
const wdfRate = await SystemConfig.getValue('wdf_base_rate_per_pound', 1.25);
const deliveryFee = affiliate.minimumDeliveryFee;
```

---

## 2. Inline Scripts in HTML

Strict CSP v2 forbids inline handlers and scripts.

Bad:
```html
<script>
  function handleClick() { /* ... */ }
</script>
<button onclick="handleClick()">Click</button>
```

Good:
```html
<button id="myButton">Click</button>
<script src="/assets/js/handlers.js"></script>
```

---

## 3. Forgetting `pageScripts` Mapping

Scripts must be registered in both the HTML file **and** the `pageScripts` mapping in `embed-app-v2.js`, or they won't load when the page is accessed via the embedded iframe.

Bad: script only referenced from HTML.
Good: add to both the HTML file and `pageScripts` in `embed-app-v2.js`.

---

## 4. Not Testing in Embedded Context

Test both access paths:
- Direct: `https://wavemax.promo/page.html`
- Embedded: `https://wavemax.promo/embed-app-v2.html?route=/page`

---

## 5. Exposing Sensitive Data in Responses

Bad:
```javascript
res.json({ user: affiliateDoc });  // Includes passwordHash
```

Good:
```javascript
const { passwordHash, passwordSalt, ...safeData } = affiliateDoc.toObject();
res.json({ user: safeData });
```

---

## 6. Missing CSRF Tokens

State-changing endpoints require a CSRF token header.

Bad:
```javascript
await fetch('/api/v1/affiliates/register', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

Good:
```javascript
const csrfToken = await getCsrfToken();
await fetch('/api/v1/affiliates/register', {
  method: 'POST',
  headers: { 'x-csrf-token': csrfToken },
  body: JSON.stringify(data)
});
```

---

## 7. Forgetting Language Translations

Always update all 4 languages (`en`, `es`, `pt`, `de`) when adding user-facing copy. English is the fallback; if it's present but other languages aren't, missing translations silently use the English text in production.

---

## 8. Floating-Point Precision in Tests

Bad:
```javascript
expect(commission).toBe(281.25);  // May fail: 281.2500000000001
```

Good:
```javascript
expect(commission).toBeCloseTo(281.25, 2);
```

---

## 9. Missing Test Cleanup

Tests that share state without `beforeEach` cleanup will fail on duplicate-key errors.

```javascript
describe('Tests', () => {
  beforeEach(async () => {
    await Affiliate.deleteMany({});
  });

  // Tests...
});
```

Also: `SystemConfig.initializeDefaults()` must run in `tests/setup.js` — tests depending on config silently fail without it.

---

## 10. Wrong Copyright Notice

Bad: `© 2025 WaveMAX`
Good: `© 2025 CRHS Enterprises, LLC. All rights reserved.`
