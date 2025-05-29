# CSRF Exclusion Analysis

## Current CSRF Excluded Endpoints

### Authentication Endpoints
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/auth/affiliate/login` | POST | Public login endpoint | HIGH | Add rate limiting + CAPTCHA |
| `/api/auth/customer/login` | POST | Public login endpoint | HIGH | Add rate limiting + CAPTCHA |
| `/api/auth/administrator/login` | POST | Public login endpoint | CRITICAL | Add rate limiting + CAPTCHA + IP whitelist |
| `/api/auth/operator/login` | POST | Public login endpoint | HIGH | Add rate limiting + CAPTCHA |
| `/api/auth/forgot-password` | POST | Public password reset | HIGH | Add rate limiting + CAPTCHA |
| `/api/auth/reset-password` | POST | Token-based reset | MEDIUM | Keep CSRF disabled, use secure tokens |
| `/api/auth/refresh-token` | POST | JWT refresh | MEDIUM | Enable CSRF for defense-in-depth |
| `/api/auth/logout` | POST | Session termination | HIGH | MUST enable CSRF |

### Registration Endpoints
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/affiliates/register` | POST | Public registration | HIGH | Add CAPTCHA + rate limiting |
| `/api/customers/register` | POST | Public registration | HIGH | Add CAPTCHA + rate limiting |

### Public Information Endpoints
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/affiliates/:affiliateId/public` | GET | Public profile view | LOW | Keep CSRF disabled (read-only) |
| `/api/customers/:customerId/profile` | GET/PUT | Mixed public/private | HIGH | Enable CSRF for PUT operations |

### Order Management Endpoints (HIGH RISK - State Changing)
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/v1/orders` | GET/POST | Order CRUD | CRITICAL | MUST enable CSRF |
| `/api/v1/orders/export` | GET | Data export | MEDIUM | Enable CSRF (data exposure) |
| `/api/v1/orders/search` | GET/POST | Search functionality | LOW-MEDIUM | Enable CSRF for POST |
| `/api/v1/orders/statistics` | GET | Read-only stats | LOW | Can keep disabled |
| `/api/v1/orders/bulk/status` | PUT | Bulk updates | CRITICAL | MUST enable CSRF |
| `/api/v1/orders/:orderId` | GET/PUT/DELETE | Order management | CRITICAL | MUST enable CSRF |
| `/api/v1/orders/:orderId/status` | PUT | Status updates | CRITICAL | MUST enable CSRF |
| `/api/v1/orders/:orderId/cancel` | POST | Order cancellation | CRITICAL | MUST enable CSRF |
| `/api/v1/orders/:orderId/payment-status` | PUT | Payment updates | CRITICAL | MUST enable CSRF |

### Customer Endpoints
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/v1/customers/:customerId` | GET/PUT/DELETE | Profile management | HIGH | MUST enable CSRF |
| `/api/v1/customers/:customerId/orders` | GET | Order history | LOW | Can keep disabled |
| `/api/v1/customers/:customerId/dashboard` | GET | Dashboard data | LOW | Can keep disabled |
| `/api/v1/customers/:customerId/password` | PUT | Password change | CRITICAL | MUST enable CSRF |
| `/api/v1/customers/:customerId/bags` | GET/POST | Bag management | HIGH | MUST enable CSRF |

### Affiliate Endpoints
| Endpoint | Method | Current Rationale | Risk Level | Recommendation |
|----------|--------|-------------------|------------|----------------|
| `/api/v1/affiliates/:affiliateId/customers` | GET | Customer list | LOW | Can keep disabled |
| `/api/v1/affiliates/:affiliateId/orders` | GET | Order list | LOW | Can keep disabled |
| `/api/v1/affiliates/:affiliateId/dashboard` | GET | Dashboard data | LOW | Can keep disabled |
| `/api/v1/affiliates/:affiliateId/delete-all-data` | DELETE | Data deletion | CRITICAL | MUST enable CSRF |

## Summary

### CRITICAL Priority (Enable CSRF Immediately)
- All DELETE operations
- All password/authentication changes
- Order creation and modifications
- Payment status updates
- Administrator login endpoint
- Data deletion endpoints

### HIGH Priority (Enable CSRF Soon)
- All PUT operations for profile updates
- Logout endpoints
- Customer/Affiliate profile modifications
- Bag management

### MEDIUM Priority (Enable with Mitigations)
- Login endpoints (add rate limiting + CAPTCHA first)
- Registration endpoints (add CAPTCHA first)
- Data export endpoints

### LOW Priority (Can Remain Disabled)
- Read-only GET endpoints that don't expose sensitive data
- Public profile views
- Statistics and dashboard views