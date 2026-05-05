/* equipmentProfileService.js
 *
 * Resolves a franchise's equipment profile from the catalog at
 * scripts/franchise-build/equipment-profiles.json. Performance metrics +
 * marketing claims (cycle time, spin rating, UV system, capacity range,
 * etc.) come from the profile, NOT hand-curated per franchise — that way
 * stores with the same equipment get the same numbers, and we don't make
 * unverified claims for stores we haven't audited.
 *
 * Each franchise's JSON references a profile by id under
 * `equipment.profileId`. If unset, it falls back to the catalog's
 * `defaultProfileId` (currently the unaudited mixed-fleet profile).
 *
 * Public surface:
 *   resolve(franchiseData) → enriched equipment object merged onto the
 *                            franchise's existing fields (washers, dryers
 *                            counts kept; profile metrics added).
 *   getProfile(id)         → raw profile or null.
 *   listProfiles()         → all profile ids (for admin tooling).
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', '..', 'scripts', 'franchise-build', 'equipment-profiles.json');

let cached = null;
let cachedMtime = 0;

function loadCatalog() {
  // Hot-reload in dev when the JSON changes; cache via mtime in prod.
  let mtime;
  try {
    mtime = fs.statSync(CATALOG_PATH).mtimeMs;
  } catch (e) {
    return { profiles: {}, defaultProfileId: null };
  }
  if (cached && mtime === cachedMtime) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    cachedMtime = mtime;
  } catch (e) {
    cached = { profiles: {}, defaultProfileId: null };
  }
  return cached;
}

function getProfile(id) {
  const catalog = loadCatalog();
  return (catalog.profiles && catalog.profiles[id]) || null;
}

function listProfiles() {
  const catalog = loadCatalog();
  return Object.keys(catalog.profiles || {});
}

function defaultProfileId() {
  return loadCatalog().defaultProfileId || null;
}

/**
 * Resolve the franchise's equipment block.
 *
 * Returns an object with:
 *   profileId          — which profile applied
 *   profileLabel       — human label for admin UI
 *   washers            — count (from franchise data, may be null if unknown)
 *   dryers             — count (from franchise data, may be null if unknown)
 *   capacityLb         — store's capacity (from franchise data) OR profile capacityLb
 *   capacityRange      — '18-80 lb' style string from profile
 *   capacityRangeDisplay — human display
 *   brand              — 'Electrolux' etc.
 *   model              — model name or null
 *   spinG              — numeric or null
 *   spinGDisplay       — '450G' or 'high-efficiency' etc.
 *   washCycleMins / dryCycleMins / fullLoadMins
 *   hasUVSanitization  — boolean (gates UV-related copy)
 *   sanitizationSystem — 'Omni LUX' or null
 *   sanitizationLabel  — 'Hospital-Grade UV Water Sanitization' or null
 *   marketingClaims    — { fast, premium, hospitalGrade, highSpin } booleans
 */
function resolve(franchiseData) {
  const eq = (franchiseData && franchiseData.equipment) || {};
  const id = eq.profileId || defaultProfileId();
  const profile = getProfile(id) || getProfile(defaultProfileId()) || {};

  return {
    profileId:                id,
    profileLabel:             profile.label || null,
    washers:                  eq.washers ?? null,
    dryers:                   eq.dryers  ?? null,
    capacityLb:               eq.capacityLb ?? profile.capacityLb ?? null,
    capacityRange:            profile.capacityRange || null,
    capacityRangeDisplay:     profile.capacityRangeDisplay || null,
    brand:                    profile.brand || null,
    model:                    profile.model || null,
    spinG:                    profile.spinG ?? null,
    spinGDisplay:             profile.spinGDisplay || null,
    washCycleMins:            profile.washCycleMins ?? null,
    dryCycleMins:             profile.dryCycleMins ?? null,
    fullLoadMins:             profile.fullLoadMins ?? null,
    hasUVSanitization:        Boolean(profile.hasUVSanitization),
    sanitizationSystem:       profile.sanitizationSystem || null,
    sanitizationLabel:        profile.sanitizationLabel || null,
    marketingClaims:          profile.marketingClaims || {
      fast: false, premium: false, hospitalGrade: false, highSpin: false
    }
  };
}

module.exports = { resolve, getProfile, listProfiles, defaultProfileId };
