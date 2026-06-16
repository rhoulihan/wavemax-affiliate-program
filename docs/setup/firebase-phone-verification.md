# Firebase Phone Verification — Setup Guide (Phase 1, PR 7)

Phone verification at bag registration uses **Firebase Authentication – Phone Auth**
(Google Cloud Identity Platform under the hood — the only Google-native SMS-OTP path).
Email verification is in-house SMTP OTP (no Firebase). This guide is what you do once;
at the end you hand back two things and I wire them in behind the `PHONE_VERIFICATION_ENABLED`
flag.

## What you'll create
A Firebase project with Phone sign-in enabled, billing on (SMS costs from first use),
reCAPTCHA Enterprise abuse protection, rundberglaundry.com authorized, one Web app
(for the client config), and one service account (for server-side token verification).

## Steps

1. **Create the project** — https://console.firebase.google.com → **Add project** →
   name it e.g. `wavemax-bag-registration`. Google Analytics can be disabled. (This
   also creates the matching Google Cloud project.)

2. **Upgrade to Blaze (pay-as-you-go)** — gear ⚙ → **Usage and billing** → **Modify plan**
   → Blaze, attach a billing account. Phone Auth SMS will not send on the free Spark plan.
   **Set a budget alert** (e.g. $25/mo) right here — SMS toll-fraud is the main cost risk.

3. **Enable Phone sign-in** — **Build → Authentication → Get started** → **Sign-in method**
   tab → enable **Phone**.

4. **Turn on abuse protection** — in the Phone provider settings, enable the **reCAPTCHA
   Enterprise** / Play Integrity protection Firebase prompts for (now required for web
   Phone Auth). Accept the default reCAPTCHA Enterprise key it offers.

5. **Authorize our domains** — **Authentication → Settings → Authorized domains** → add
   `rundberglaundry.com`, `www.rundberglaundry.com`, and `localhost` (for local testing
   on :3001).

6. **Register a Web app** — **Project settings (gear) → General → Your apps → Web (`</>`)**
   → register (no Hosting needed). Copy the **firebaseConfig** object it shows — looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "wavemax-bag-registration.firebaseapp.com",
     projectId: "wavemax-bag-registration",
     storageBucket: "wavemax-bag-registration.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123..."
   };
   ```
   That whole block is **#1 to hand back** (it's public — safe to share; it's embedded in
   the page).

7. **Create a server service account** — **Project settings → Service accounts** →
   **Generate new private key** → downloads a JSON file. That JSON is **#2 to hand back**,
   and it is a **SECRET** — it lets the server verify the OTP tokens via the Firebase Admin
   SDK. Don't paste it in chat if you can avoid it; drop it on the box at a path and tell me
   the path, or share it securely. It'll live on-box (gitignored), never committed.

## What to hand back to me
1. The **firebaseConfig** block from step 6 (public).
2. The **service-account JSON** from step 7 (secret — path on the box, or shared securely).

## How I'll wire it (so you know the shape)
- Client config → `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID` (surfaced to the registration page).
- Server credential → `FIREBASE_SERVICE_ACCOUNT_PATH` (a file path on the box; the JSON file
  stays off git) for the Admin SDK that verifies the phone ID token.
- `PHONE_VERIFICATION_ENABLED=true` flips phone verification on. While it's off (or before
  keys land), registration runs **email-OTP only**; with it on, registration is **blocked
  until the phone is verified** (per the Phase 1 spec).
- CSP gets the Firebase/reCAPTCHA origins added (gstatic/googleapis/recaptcha) for the
  registration page only.

## Notes / gotchas
- It's a **client-driven flow**: the browser SDK + reCAPTCHA sends the OTP; the server only
  verifies the returned ID token. There's no server-side "POST a number, send OTP" REST call
  (by design, for abuse prevention).
- Cost ~$0.01–0.06 per US verification; international varies and changes — the budget alert
  is your guardrail.
- We do **not** adopt Firebase as our auth system — we only consume the verified phone number
  from the ID token, then create our own Customer record.
