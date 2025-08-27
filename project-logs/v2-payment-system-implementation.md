# V2 Payment System Implementation Log

**Project Start Date:** 2025-01-27
**Status:** IN PROGRESS
**Current Phase:** Phase 1 - Configuration & Feature Toggle

## Project Overview
Replacing credit card payments (Paygistix) with Venmo, PayPal, and CashApp payment links. Implementing automated payment verification via email scanning on payments@wavemax.promo.

## Key Requirements
- No payment during registration (v2 customers get 1-2 free bags)
- Generate payment links after laundry is weighed
- Automated payment verification via Mailcow email scanning
- Hold pickup notifications until payment verified
- Feature toggle to switch between v1 and v2 systems

## Implementation Phases

### Phase 1: Configuration & Feature Toggle ⏳
- [ ] Add SystemConfig entries for v2 payment system
- [ ] Update database schemas (Customer, Order models)
- [ ] Create payment link generation service
- [ ] Implement feature toggle logic

### Phase 2: Email Integration 📧
- [ ] Mailcow API integration service
- [ ] Email parser for Venmo notifications
- [ ] Email parser for PayPal notifications
- [ ] Email parser for CashApp notifications
- [ ] Payment verification cron job

### Phase 3: V2 Registration & Scheduling 📝
- [ ] Create customer-register-v2-embed.html
- [ ] Create schedule-pickup-v2-embed.html
- [ ] Update authController for v2 registration
- [ ] Update orderController for v2 scheduling

### Phase 4: Payment Processing Flow 💰
- [ ] Payment request generation after weighing
- [ ] QR code generation for payment methods
- [ ] Payment verification loop after WDF
- [ ] Notification hold/release logic

### Phase 5: Admin & Testing 🎯
- [ ] Admin dashboard payment monitoring
- [ ] Manual payment override interface
- [ ] End-to-end testing
- [ ] Production deployment

## Progress Log

### 2025-01-27 - Session Start
**Time:** [Session Start]
**Tasks Planned:**
1. Create project documentation
2. Implement SystemConfig updates
3. Update database schemas
4. Create payment link service

**Next Steps:**
- Starting with SystemConfig updates to add v2 payment configuration entries

---

## Technical Decisions

### Payment Link Formats
```javascript
// Venmo
venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=WaveMAX%20Order%20%23${orderId}

// PayPal
https://paypal.me/${handle}/${amount}USD?notes=WaveMAX%20Order%20%23${orderId}

// CashApp
https://cash.app/${handle}/${amount}?note=WaveMAX%20Order%20%23${orderId}
```

### Email Scanning Strategy
- Poll payments@wavemax.promo every 5 minutes
- Parse emails for order ID in memo/note field
- Match amount with order total
- Auto-verify and trigger notifications

### Database Changes
- Order.paymentStatus: ['pending', 'awaiting', 'verified', 'failed']
- Order.paymentLinks: {venmo, paypal, cashapp}
- Order.paymentQRCodes: {venmo, paypal, cashapp}
- Customer.registrationVersion: 'v1' | 'v2'
- Customer.initialBagsRequested: Number

## Files Modified
- (Will be updated as implementation progresses)

## Testing Checklist
- [ ] V2 registration without payment
- [ ] Payment link generation
- [ ] QR code generation
- [ ] Email parsing for each provider
- [ ] Payment verification flow
- [ ] Notification hold/release
- [ ] Feature toggle switching
- [ ] Backward compatibility with v1

## Known Issues / Blockers
- None yet

## Session Notes
- Implementation plan reviewed and approved by user
- Starting with core infrastructure (SystemConfig, schemas)
- Maintaining backward compatibility throughout

---

*This log will be updated continuously during implementation*