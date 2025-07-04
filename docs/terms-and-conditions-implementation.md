# Terms and Conditions Implementation

## Overview
Created comprehensive Terms and Conditions that clearly limit WaveMAX liability to Wash Dry Fold activities only, placing all pickup and delivery responsibilities on the Affiliate Partner.

## Key Features

### 1. Liability Limitation
- **WaveMAX Liability**: Limited exclusively to the washing, drying, and folding process at their facility
- **Affiliate Liability**: All pickup and delivery operations, including:
  - Transportation risks
  - Vehicle accidents
  - Theft during transit
  - Customer property in vehicles
  - Delayed or missed pickups/deliveries
  - Personal injury during delivery

### 2. Insurance Requirements
Affiliates must maintain:
- Commercial General Liability: $1,000,000
- Commercial Auto Insurance: $1,000,000
- Workers' Compensation: As required by law
- Cargo/Inland Marine: $10,000 minimum

### 3. Clear Division of Responsibilities
- **WaveMAX**: Wash, dry, fold, and technology platform
- **Affiliate**: All transportation and customer interaction during pickup/delivery

### 4. Maximum Liability Caps
If WaveMAX is found liable for laundry damage:
- Lesser of actual value, 10x cleaning charge, or $500 per order

## Files Created/Modified

### New Files:
1. `/public/terms-and-conditions.html` - Standalone terms page
2. `/public/terms-and-conditions-embed.html` - Embedded version for iframe
3. `/docs/terms-and-conditions-implementation.md` - This documentation

### Modified Files:
1. `/server.js` - Updated routes to serve new terms
2. `/public/embed-app-v2.html` - Updated route mapping

### Backup:
- `/public/terms-of-service-old.html` - Original terms backed up

## URL Access
- Direct: `https://wavemax.promo/terms-and-conditions`
- Legacy: `https://wavemax.promo/terms-of-service` (redirects to new terms)
- Embedded: Within the application iframe

## Integration Points
All registration forms and legal links now point to the new comprehensive terms and conditions that protect WaveMAX from delivery-related liabilities.

## Legal Highlights
1. Independent Contractor status clearly defined
2. Indemnification clause protecting WaveMAX
3. Customer claim routing (wash issues to WaveMAX, delivery issues to Affiliate)
4. Data protection requirements
5. Termination provisions
6. Texas law governance and arbitration requirement

## Next Steps
- Review by legal counsel recommended
- Consider adding version tracking for terms acceptance
- Update affiliate onboarding to emphasize liability division
- Create customer-facing notice about delivery responsibility