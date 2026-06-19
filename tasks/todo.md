# Active task — order-start redesign on /claim (no persistent session) — DONE

Scope: /claim QR flow ONLY (kiosk unchanged). In-progress bags: keep the existing advance flow;
the new start/cancel prompt is only for the no-order case.

Decisions:
- Remove the PERSISTENT (batch) scan session → each bag = fresh scan + code (customer phone/email or staff code).
- CUSTOMER start (two-button [Start my order]) → directly start → show partner pickup instructions + "order received".
- STAFF start (code) → if no order: confirm "Start an order?" [Start]/[Cancel] → "order received", NO instructions.
- In-progress bag (staff) → existing state-driven advance (unchanged).
- Either start → customer order-created email if emailVerified (already wired in notifyTransition).

## Backend
- [x] scanService.resolveScan: include affiliate pickupInstructions (+ serviceType) in the response.

## Frontend
- [x] scan-session.js: session held IN-MEMORY (drop sessionStorage) → no persistence across bag QR loads.
- [x] claim.js: enterStaffScan always shows the code panel; customerStartOrder() starts directly →
      #claim-order-result (+ instructions, "already in progress" on race); staff create-pending →
      "Start an order?" [Start]/[Cancel] → result with NO instructions; advance → existing confirm;
      dropped endSession / showSessionActive.
- [x] claim-embed.html: #claim-order-result (title + customer-only instructions) + customer-start-error;
      removed #scan-end-session / #scan-session-active.
- [x] i18n en/es/pt/de: claim.scan.startAnOrder/startBtn/cancelBtn/orderReceived/alreadyInProgress
      (+ claim.networkError fix). Parity: 0 errors.
- [x] claimPageWiring + i18nScanKeys tests updated; all 8 scan/order backend suites green.

## Review / gate / deploy
- [x] Two adversarial reviewers; fixes: dead selfStartByCustomer removed, redundant inner requires cleaned,
      hardcoded network-error string i18n'd, instruction-gate tests added. (PROMPT_KEYS namespacing = false alarm.)
- [x] Full gate: failing set ⊆ 14-suite environmental baseline (exit 0).
- [x] Deploy both OCI boxes (git pull --ff-only + pm2 reload) + verify live. Commit 80ccfa5; both boxes
      online; CF-live verified (claim.js customerStartOrder×3, scan-session in-memory, #claim-order-result,
      en/es/pt/de startAnOrder).
