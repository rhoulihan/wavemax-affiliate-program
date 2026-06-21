// Add-on catalog controller — public active-only read + admin CRUD.
//
// The catalog is admin-managed business config (perm: system_config). The
// public read powers the customer order form; the admin endpoints manage the
// list. DELETE is a SOFT delete (deactivate) so historical orders that
// reference a retired add-on still resolve its label.

const { validationResult } = require('express-validator');
const AddOn = require('../models/AddOn');
const ControllerHelpers = require('../utils/controllerHelpers');
const { logAuditEvent, AuditEvents } = require('../utils/auditLogger');
const logger = require('../utils/logger');

const { asyncWrapper } = ControllerHelpers;

// Derive a slug key from a free-text name: lowercase, non-alnum → underscore,
// collapse repeats, trim edges. ("Hypoallergenic Wash!" -> "hypoallergenic_wash")
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

// Shape an add-on for API output (admin sees isActive/sortOrder too).
function present(a) {
  return {
    addOnId: a.addOnId,
    key: a.key,
    name: a.name,
    price: a.price || 0,
    priceUnit: a.priceUnit || 'flat',
    translations: { es: a.translations.es || '', pt: a.translations.pt || '', de: a.translations.de || '' },
    isActive: a.isActive,
    sortOrder: a.sortOrder
  };
}

// Coerce a price input to a non-negative number, or undefined if absent/invalid.
function sanitizePrice(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// Normalize a priceUnit input to a valid enum, or undefined if absent/invalid.
function sanitizePriceUnit(value) {
  if (value === undefined || value === null || value === '') return undefined;
  return (value === 'flat' || value === 'per_lb') ? value : undefined;
}

/** GET /api/v1/addons — public, active only (key + name + translations, sorted). */
exports.listPublic = asyncWrapper(async (req, res) => {
  const addOns = await AddOn.getActive();
  return ControllerHelpers.sendSuccess(res, {
    addOns: addOns.map(a => ({
      key: a.key,
      name: a.name,
      price: a.price || 0,
      priceUnit: a.priceUnit || 'flat',
      translations: { es: a.translations.es || '', pt: a.translations.pt || '', de: a.translations.de || '' }
    }))
  }, 'Add-ons retrieved');
});

/** GET /api/v1/administrators/addons — admin, ALL add-ons (incl. inactive). */
exports.listAll = asyncWrapper(async (req, res) => {
  const addOns = await AddOn.find().sort({ sortOrder: 1, name: 1 });
  return ControllerHelpers.sendSuccess(res, { addOns: addOns.map(present) }, 'Add-ons retrieved');
});

/** POST /api/v1/administrators/addons — admin, create. */
exports.create = asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const name = String(req.body.name || '').trim();
  const key = slugify(req.body.key || name);
  if (!key) {
    return ControllerHelpers.sendError(res, 'A valid key or name is required', 400, [{ code: 'invalid_key' }]);
  }

  const exists = await AddOn.findOne({ key });
  if (exists) {
    return ControllerHelpers.sendError(res, `Add-on key already exists: ${key}`, 409, [{ code: 'duplicate_key' }]);
  }

  const t = req.body.translations || {};
  const price = sanitizePrice(req.body.price);
  const priceUnit = sanitizePriceUnit(req.body.priceUnit);
  const addOn = await AddOn.create({
    key,
    name,
    price: price !== undefined ? price : 0,
    priceUnit: priceUnit !== undefined ? priceUnit : 'flat',
    translations: {
      es: String(t.es || '').trim(),
      pt: String(t.pt || '').trim(),
      de: String(t.de || '').trim()
    },
    isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    sortOrder: req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : 0
  });

  logAuditEvent(AuditEvents.ADDON_CREATED, {
    adminId: req.user.id, addOnId: addOn.addOnId, key
  }, req);
  logger.info('Add-on created', { addOnId: addOn.addOnId, key });

  return ControllerHelpers.sendSuccess(res, { addOn: present(addOn) }, 'Add-on created', 201);
});

/** PATCH /api/v1/administrators/addons/:addOnId — admin, update (key immutable). */
exports.update = asyncWrapper(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const addOn = await AddOn.findOne({ addOnId: req.params.addOnId });
  if (!addOn) {
    return ControllerHelpers.sendError(res, 'Add-on not found', 404, [{ code: 'not_found' }]);
  }

  const changed = {};
  if (req.body.name !== undefined) {
    addOn.name = String(req.body.name).trim();
    changed.name = addOn.name;
  }
  if (req.body.translations !== undefined && typeof req.body.translations === 'object') {
    for (const lang of ['es', 'pt', 'de']) {
      if (req.body.translations[lang] !== undefined) {
        addOn.translations[lang] = String(req.body.translations[lang]).trim();
      }
    }
    changed.translations = true;
  }
  if (req.body.price !== undefined) {
    const price = sanitizePrice(req.body.price);
    if (price !== undefined) {
      addOn.price = price;
      changed.price = addOn.price;
    }
  }
  if (req.body.priceUnit !== undefined) {
    const priceUnit = sanitizePriceUnit(req.body.priceUnit);
    if (priceUnit !== undefined) {
      addOn.priceUnit = priceUnit;
      changed.priceUnit = addOn.priceUnit;
    }
  }
  if (req.body.sortOrder !== undefined) {
    addOn.sortOrder = Number(req.body.sortOrder);
    changed.sortOrder = addOn.sortOrder;
  }
  if (req.body.isActive !== undefined) {
    addOn.isActive = !!req.body.isActive;
    changed.isActive = addOn.isActive;
  }
  // `key` is intentionally NOT updatable — orders reference it.

  await addOn.save();

  logAuditEvent(AuditEvents.ADDON_UPDATED, {
    adminId: req.user.id, addOnId: addOn.addOnId, changed: Object.keys(changed)
  }, req);
  logger.info('Add-on updated', { addOnId: addOn.addOnId, changed: Object.keys(changed) });

  return ControllerHelpers.sendSuccess(res, { addOn: present(addOn) }, 'Add-on updated');
});

/** DELETE /api/v1/administrators/addons/:addOnId — admin, SOFT delete (deactivate). */
exports.deactivate = asyncWrapper(async (req, res) => {
  const addOn = await AddOn.findOne({ addOnId: req.params.addOnId });
  if (!addOn) {
    return ControllerHelpers.sendError(res, 'Add-on not found', 404, [{ code: 'not_found' }]);
  }
  addOn.isActive = false;
  await addOn.save();

  logAuditEvent(AuditEvents.ADDON_DEACTIVATED, {
    adminId: req.user.id, addOnId: addOn.addOnId, key: addOn.key
  }, req);
  logger.info('Add-on deactivated', { addOnId: addOn.addOnId, key: addOn.key });

  return ControllerHelpers.sendSuccess(res, { addOn: present(addOn) }, 'Add-on deactivated');
});
