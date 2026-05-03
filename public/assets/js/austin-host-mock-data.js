/* Austin host-page data — extracted from inline <script> for CSP compliance.
 *
 * Sets:
 *   window.GOOGLE_PLACES_API_KEY  (Google Places API New, browser-side)
 *   window.LOCATION_PLACE_ID      (the franchisee's Google Place ID)
 *   window.LOCATION_DATA          (single source of truth for the chrome)
 *
 * Loaded BEFORE parent-iframe-bridge-v3.js + austin-host-mock.js so those
 * scripts can read the data. The OR-fallback pattern means external scripts
 * (tests, dev tools) can pre-set GOOGLE_PLACES_API_KEY / LOCATION_PLACE_ID
 * and they won't be overwritten here.
 *
 * To enable live Google reviews:
 *   1. Get a Places API (New) key in Google Cloud Console
 *   2. Restrict it to Places API + HTTP referrers (*.wavemax.promo/*, etc.)
 *   3. Find the WaveMAX Austin Place ID via Find Place From Text
 *   4. Paste the values into the two `||  ''` fallbacks below
 */
(function () {
  'use strict';

  window.GOOGLE_PLACES_API_KEY = window.GOOGLE_PLACES_API_KEY || '';
  window.LOCATION_PLACE_ID     = window.LOCATION_PLACE_ID     || '';

  window.LOCATION_DATA = {
    slug: "austin-tx",
    brand: { name: "WaveMAX Laundry Austin", parent: "WaveMAX Laundry" },
    contact: {
      phone:        "(512) 553-1674",
      phoneTel:     "tel:+15125531674",
      phoneTelRaw:  "+15125531674",
      email:        "john@austinwavemax.com",
      emailMailto:  "mailto:john@austinwavemax.com",
      address:      "825 E Rundberg Ln F1",
      city:         "Austin",
      state:        "TX",
      zip:          "78753",
      country:      "US",
      addressLine2: "Austin, TX 78753",
      geo:          { lat: 30.3564789, lng: -97.6858016 },
      mapsUrl:      "https://www.google.com/maps/dir/?api=1&destination=825+E+Rundberg+Ln+F1+Austin+TX+78753",
      placeId:      ""
    },
    hours: {
      open:     "07:00",
      close:    "22:00",
      display:  "7am-10pm",
      lastWash: "9pm",
      days:     "Every day, 365 days a year"
    },
    owner: {
      name: "Colin Houlihan",
      role: "Owner / Operator",
      bio: "North Austin local. Running the busiest WaveMAX in Texas, focused on a clean store, fast machines, and friendly staff.",
      neighborhood: "North Austin"
    },
    pricing: {
      wdf:       { rate: 1.20, minLb: 10, currency: "USD", display: "$1.20/lb" },
      selfServe: {
        minLoad: 2.75,
        maxLoad: 10.50,
        minLoadDisplay: "$2.75",
        maxLoadDisplay: "$10.50",
        washMin: 20,
        dryMin: 20,
        rangeDisplay: "$2.75 – $10.50"
      }
    },
    equipment: { washers: 42, dryers: 42, capacityLb: 80 },
    amenities: ["Free WiFi", "Hospital-Grade UV Sanitization", "Free Parking", "Wheelchair Accessible"],
    serviceArea: ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown", "Leander"],
    social: { facebook: "", instagram: "" },
    google: { placeId: "", profileUrl: "", reviewsUrl: "" },
    i18n: { languagesAvailable: ["en", "es", "pt", "de"] }
  };
})();
