# Paygistix Callback Parameters Documentation

## Overview
This document details the parameters that Paygistix includes in their callback requests based on analysis of production server logs.

## Callback URL
Paygistix redirects to: `/payment-callback-handler.html?[parameters]`

## Query String Parameters

Based on actual production callbacks, Paygistix includes the following 11 parameters:

| Parameter | Description | Example Value | Notes |
|-----------|-------------|---------------|-------|
| `hash` | Security validation hash | `[32-character string]` | Used to verify request authenticity |
| `MerchantID` | Merchant identifier | `wmaxaustWEB` | Consistent across all callbacks |
| `OrderID` | Unique order/form ID | `WMAX1734735974123` | Generated for each transaction |
| `Amount` | Transaction amount | `10.00` | Decimal format |
| `PNRef` | Payment reference number | `12345678` | Paygistix transaction ID |
| `Result` | Transaction result code | `0` | 0 = Success, other values = failure |
| `TxnType` | Transaction type | `SALE` | Type of transaction |
| `Last4` | Last 4 digits of card | `1111` | For display purposes |
| `ExpDate` | Card expiration | `1225` | MMYY format |
| `CardType` | Card brand | `VISA` | VISA, MC, AMEX, DISC |
| `AuthCode` | Authorization code | `123456` | Present on successful transactions |

## Example Successful Callback

```
/payment-callback-handler.html?
hash=ABCDEF1234567890ABCDEF1234567890&
MerchantID=wmaxaustWEB&
OrderID=WMAX1734735974123&
Amount=10.00&
PNRef=87654321&
Result=0&
TxnType=SALE&
Last4=1111&
ExpDate=1225&
CardType=VISA&
AuthCode=654321
```

## Result Codes
- `0` - Transaction successful
- Other values indicate various failure reasons (declined, error, etc.)

## Important Notes

1. **Custom Fields**: The `custom1` field we add to store payment tokens does NOT appear in the callback
2. **Security**: The `hash` parameter should be validated to ensure the callback is legitimate
3. **IP Address**: Production callbacks come from Paygistix IP: 70.114.167.145
4. **Method**: Callbacks can be either GET or POST requests

## Testing

Use the test form at `/test-payment` (non-production only) to simulate Paygistix callbacks with these parameters.