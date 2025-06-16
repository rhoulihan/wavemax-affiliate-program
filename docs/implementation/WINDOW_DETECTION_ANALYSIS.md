# Window Detection Analysis - Cross-Origin Issue

## Problem Summary
When the WaveMAX affiliate app (running on wavemax.promo) is embedded in an iframe on www.wavemaxlaundry.com, the test payment window was being incorrectly detected as closed immediately after opening, while the Paygistix payment window worked correctly.

## Root Cause Analysis

### Key Findings:
1. **Both windows are cross-origin** from the iframe's perspective:
   - Test form: Opens wavemax.promo/test-payment 
   - Paygistix: Opens safepay.paymentlogistics.net

2. **Different window opening methods**:
   - Paygistix: Opens empty window (`window.open('', ...)`) then submits form to it
   - Test form: Was opening with direct URL (`window.open('/test-payment', ...)`)

3. **Browser behavior**: When opening a window with a URL from within a cross-origin iframe, some browsers may report `window.closed = true` immediately, even though the window is actually open. This appears to be a security measure.

## Solution Implemented

### 1. Modified Window Opening Method
Changed test payment window to open like Paygistix does:
```javascript
// Before: Direct URL
paymentWindow = window.open(testPaymentUrl, 'TestPaymentWindow', windowFeatures);

// After: Empty window then navigate
paymentWindow = window.open('', 'TestPaymentWindow', windowFeatures);
if (paymentWindow) {
    paymentWindow.location.href = testPaymentUrl;
}
```

### 2. Used Absolute URLs
Ensured the test payment URL is absolute to avoid any ambiguity:
```javascript
const baseUrl = window.location.protocol + '//' + window.location.host;
const testPaymentUrl = `${baseUrl}/test-payment?token=${paymentToken}...`;
```

### 3. Increased Tolerance for Test Mode
- Changed `maxFailures` from 1 to 3 for test mode (allows window time to navigate)
- Increased initial monitoring delay from 2s to 3s for test mode
- Added better logging to diagnose window state

### 4. Enhanced Diagnostics
- Added logging for `window.closed` property type and value
- Created test pages to isolate and debug the issue
- Added postMessage communication when test form loads

## Testing Recommendations

1. Test the payment flow from within the iframe on www.wavemaxlaundry.com
2. Verify that both Paygistix and test payment windows:
   - Open successfully
   - Are monitored correctly
   - Close detection works properly
   - Payment completion is tracked

3. Use the diagnostic pages if issues persist:
   - `/test-window-detection.html` - Tests various window opening scenarios
   - `/test-iframe-window.html` - Tests window opening from within iframes

## Browser Compatibility Notes

Different browsers handle cross-origin window references differently:
- Chrome/Edge: May report `window.closed = true` for cross-origin windows immediately
- Firefox: Generally more permissive with window references
- Safari: Strictest cross-origin policies

The solution implemented should work across all major browsers by:
1. Using the empty window approach (most compatible)
2. Having multiple fallback detection methods
3. Allowing for initial false positives in test mode