# CSP v2 Migration Tracker

Last Updated: 2025-01-18

## Overview
This document tracks the progress of migrating all HTML pages to Content Security Policy (CSP) v2 compliance. Pages must have no inline scripts, no inline styles, and no event handler attributes.

## Migration Status Legend
- ✅ **Completed** - Fully migrated to CSP v2
- 🚧 **In Progress** - Currently being worked on
- ❌ **Not Started** - Needs migration
- ❓ **Needs Verification** - May be compliant but needs review

---

## High Priority Pages (Core Authentication & Dashboards)

### Authentication Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `affiliate-login-embed.html` | ✅ Completed | - | Migrated with OAuth support |
| `affiliate-register-embed.html` | ✅ Completed | - | Migrated with address validation |
| `customer-login-embed.html` | ✅ Completed | - | Migrated with OAuth support, fixed affiliate conflict handling |
| `customer-register-embed.html` | ✅ Completed | - | Migrated with payment form and OAuth support, fixed Paygistix window monitoring |
| `administrator-login-embed.html` | ✅ Completed | - | Migrated, moved inline script to init file |
| `operator-login-embed.html` | 🚫 Not Needed | 1 inline script, 1 onclick | Operators auto-login by IP, page not used |
| `forgot-password-embed.html` | ✅ Completed | - | New CSP-compliant page |
| `reset-password-embed.html` | ✅ Completed | - | New CSP-compliant page |

### Dashboard Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `administrator-dashboard-embed.html` | ✅ Completed | - | Complex migration: moved 38 inline styles, 8 event handlers, 1 inline script |
| `affiliate-dashboard-embed.html` | ✅ Completed | - | Migrated with all functionality intact |
| `customer-dashboard-embed.html` | ✅ Completed | - | Migrated, moved inline style to CSS |

---

## Medium Priority Pages (Customer Flow & Payments)

### Order & Schedule Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `schedule-pickup-embed.html` | ✅ Completed | - | Customer flow with payment integration |
| `order-confirmation-embed.html` | ✅ Completed | - | Order completion with API data loading |

### Success Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `customer-success-embed.html` | ✅ Completed | - | Registration success page, fixed inline styles |
| `affiliate-success-embed.html` | ✅ Completed | - | Migrated, linked existing init.js file |
| `payment-success-embed.html` | ✅ Completed | - | Payment flow |
| `payment-error-embed.html` | ✅ Completed | - | Payment flow |

### Payment Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `payment-form-embed.html` | 🗄️ Quarantined | 1 inline style, 2 inline scripts | Unused - moved to quarantine 2025-01-18 |
| `payment-methods-embed.html` | 🗄️ Quarantined | Unknown | Unused - moved to quarantine 2025-01-18 |
| `paygistix-order-payment.html` | 🗄️ Quarantined | 2 inline styles, 1 event handler | Unused - moved to quarantine 2025-01-18 |
| `paygistix-payment-embed.html` | 🗄️ Quarantined | 1 inline style, 1 event handler | Unused - moved to quarantine 2025-01-18 |

---

## Lower Priority Pages (Landing & Misc)

### Landing Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `franchisee-landing.html` | ✅ Completed | - | Migrated, moved 18 inline styles and 2 script blocks to external files |
| `embed-landing.html` | ✅ Completed | - | Already CSP compliant, updated nonce format |
| `affiliate-landing-embed.html` | ✅ Completed | - | Migrated, moved inline scripts to init.js |

### Utility Pages
| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `operator-scan-embed.html` | ✅ Completed | - | Operator tools |
| `terms-and-conditions-embed.html` | ✅ Completed | - | Legal |
| `privacy-policy.html` | ✅ Completed | - | Legal |
| `embed-app.html` | ✅ Completed | - | Legacy version quarantined, replaced with CSP-compliant redirect to v2 |
| `embed-app-v2.html` | ✅ Completed | - | New CSP v2 container |

---

## Test & Demo Pages (Lowest Priority)

| Page | Status | Violations | Notes |
|------|--------|------------|-------|
| `swirl-spinner-demo.html` | ❌ Not Started | 7 inline styles, 1 event handler | Demo page |
| `wavemax-development-prompt.html` | ❌ Not Started | 6 inline styles, 6 event handlers | Development tool |
| `clear-admin-session.html` | ❌ Not Started | 2 inline styles, 4 event handlers | Admin tool |
| Various test pages | ❌ Not Started | Various | Can be deprecated |

---

## Migration Checklist for Each Page

When migrating a page to CSP v2, ensure:

- [ ] Remove all inline `style=""` attributes → Move to CSS classes
- [ ] Remove all inline event handlers (`onclick`, `onsubmit`, etc.) → Move to addEventListener
- [ ] Remove all `<script>` tags with inline JavaScript → Move to external .js files
- [ ] Add proper CSS file for page-specific styles
- [ ] Add initialization JavaScript file with event listeners
- [ ] Test all functionality still works
- [ ] Verify no CSP violations in browser console
- [ ] Update this tracking document

---

## Statistics

- **Total Pages**: 67
- **Completed**: 25 (37.3%)
- **Quarantined**: 5 (7.5%) - includes legacy embed-app.html
- **In Progress**: 0 (0%)
- **Not Started**: 13 (19.4%)
- **Needs Verification**: 24 (35.8%)
- **Test/Coverage**: 6 (9%)

## Next Steps

1. ~~Verify and migrate customer login pages (customer-login-embed.html)~~ ✅ Completed
2. ~~Migrate customer registration page (customer-register-embed.html)~~ ✅ Completed
3. ~~Migrate customer success page (customer-success-embed.html)~~ ✅ Completed
4. ~~Verify and migrate admin login page (administrator-login-embed.html)~~ ✅ Completed
5. ~~Tackle administrator dashboard (highest violation count)~~ ✅ Completed
6. Migrate landing page (embed-landing.html) for main entry point
7. Migrate affiliate dashboard (medium priority)
8. Complete remaining customer flow pages

---

## Notes

- All new pages should be created with CSP v2 compliance from the start
- Consider deprecating test pages rather than migrating them
- Payment pages are critical and need careful testing after migration
- Dashboard pages are complex and will require significant refactoring
- Customer registration flow fully migrated with Paygistix payment integration working properly
- Direct navigation approach used for CSP v2 pages to ensure proper nonce injection