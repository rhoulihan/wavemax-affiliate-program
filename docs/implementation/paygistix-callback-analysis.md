# Paygistix Payment Callback Analysis

## Summary of Callback Requests Found (Last 24 Hours)

Based on the server logs analysis, I found multiple successful Paygistix payment callback requests. Here are the details:

## Callback URL Pattern
```
/payment-callback-handler.html?[parameters]
```

## Query Parameters Sent by Paygistix

All successful callbacks include the following parameters:

1. **hash** - Security hash for validation (e.g., `7ec0ebebcb8d5ab3ceaa6423e5a10be8`)
2. **MerchantID** - Merchant identifier (`wmaxaustWEB`)
3. **OrderID** - Unique order/form ID (e.g., `55016041050`)
4. **Amount** - Transaction amount (e.g., `10.00`)
5. **PNRef** - Payment reference number (e.g., `804322218`)
6. **Result** - Transaction result code (`0` = Success)
7. **TxnType** - Transaction type (`SALE`)
8. **Last4** - Last 4 digits of card (e.g., `0309`)
9. **ExpDate** - Card expiration date (e.g., `0329` = March 2029)
10. **CardType** - Card brand (e.g., `VISA`)
11. **AuthCode** - Authorization code (e.g., `01604D`)

## Example Successful Callbacks

### Example 1 (2025-06-13 00:34:43 UTC)
```
/payment-callback-handler.html?hash=7ec0ebebcb8d5ab3ceaa6423e5a10be8&MerchantID=wmaxaustWEB&OrderID=55016041050&Amount=10.00&PNRef=804322218&Result=0&TxnType=SALE&Last4=0309&ExpDate=0329&CardType=VISA&AuthCode=01604D
```

### Example 2 (2025-06-13 01:12:17 UTC)
```
/payment-callback-handler.html?hash=c871804d3e037b41c4a0c48a53f64517&MerchantID=wmaxaustWEB&OrderID=55016061302&Amount=10.00&PNRef=804335096&Result=0&TxnType=SALE&Last4=0309&ExpDate=0329&CardType=VISA&AuthCode=02407D
```

### Example 3 (2025-06-13 02:10:16 UTC)
```
/payment-callback-handler.html?hash=efcc5bccf799af4bda49874be40701e7&MerchantID=wmaxaustWEB&OrderID=55016091788&Amount=10.00&PNRef=804352037&Result=0&TxnType=SALE&Last4=0309&ExpDate=0329&CardType=VISA&AuthCode=07630D
```

## Key Observations

1. **All callbacks came from Paygistix domain**: `https://safepay.paymentlogistics.net/`
2. **Result=0 indicates success**: All examples show successful transactions
3. **Consistent parameter set**: Every callback includes the same 11 parameters
4. **Security hash**: Each transaction has a unique hash for validation
5. **Card details**: Limited card information is returned (Last4, ExpDate, CardType)
6. **Authorization codes**: Each successful transaction has a unique auth code

## Payment Flow

1. User submits payment form to Paygistix (`https://safepay.paymentlogistics.net/transaction.asp`)
2. Paygistix processes the payment
3. Paygistix redirects back to `/payment-callback-handler.html` with query parameters
4. The callback handler processes the response and redirects to `/registration-success.html`

## Additional Context

From the logs, I can see that the payment forms are using:
- Form-based payments (txnType: "FORM")
- Multiple product codes (WDF, BF, PBF5, etc.) for different services
- The ReturnURL is set to `https://wavemax.promo/payment-callback-handler.html`

## Recommendations for Implementation

When processing these callbacks:
1. Always validate the hash parameter for security
2. Check Result=0 for successful transactions
3. Store the PNRef as the payment reference
4. Use the AuthCode for transaction verification
5. Handle non-zero Result codes as failures