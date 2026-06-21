// AddOn catalog model — admin-managed order add-ons (premium detergent, stain
// remover, fabric softener, …; more over time). An Order stores the stable
// `key` slug(s); the per-language labels (en `name` + es/pt/de `translations`)
// render on the customer order form and the operator intake modal.
//
// Money still settles in Cents (external). The `price` here is DISPLAY-ONLY:
// it itemizes premium add-ons on the customer order form and the confirmation
// email. 0 = a free option (rendered in the Free Options table).

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Slug: lowercase letters, digits, underscores. Stable join key on Order.addOns.
const KEY_SLUG = /^[a-z0-9_]+$/;

const addOnSchema = new mongoose.Schema({
  addOnId: {
    type: String,
    default: () => 'ADDON-' + uuidv4(),
    unique: true
  },
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [KEY_SLUG, 'key must be a lowercase slug (a-z, 0-9, underscore)']
  },
  name: { type: String, required: true, trim: true, maxlength: 100 },  // English label
  translations: {
    es: { type: String, trim: true, default: '', maxlength: 100 },
    pt: { type: String, trim: true, default: '', maxlength: 100 },
    de: { type: String, trim: true, default: '', maxlength: 100 }
  },
  // Display-only price (USD). 0 = free option. Money still settles in Cents.
  // `priceUnit` is how the rate reads on the form/confirmation — a flat amount
  // ("$5.00") or a per-pound rate ("$0.50/lb"). Per-pound is DISPLAY-ONLY (we
  // never weigh in-app); it changes the label, not any calculation.
  price: { type: Number, default: 0, min: 0, max: 10000 },
  priceUnit: { type: String, enum: ['flat', 'per_lb'], default: 'flat' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

// Active catalog for the customer order form, deterministic order.
addOnSchema.statics.getActive = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Resolve an order's stored add-on keys to display rows {key,name,price,
// translations}, preserving the order of `keys`. A retired/unknown key falls
// back to its slug with price 0 (history still renders). Shared by the operator
// intake modal (scanService) and the order emails (orderTransitionService).
addOnSchema.statics.resolveKeys = async function (keys) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const catalog = await this.find({ key: { $in: keys } });
  const byKey = new Map(catalog.map(a => [a.key, a]));
  return keys.map(k => {
    const a = byKey.get(k);
    return a
      ? { key: a.key, name: a.name, price: a.price || 0, priceUnit: a.priceUnit || 'flat',
        translations: { es: a.translations.es || '', pt: a.translations.pt || '', de: a.translations.de || '' } }
      : { key: k, name: k, price: 0, priceUnit: 'flat', translations: { es: '', pt: '', de: '' } };
  });
};

// The three current add-ons, all four languages. Idempotent + non-clobbering:
// $setOnInsert only, so re-running never overwrites an admin's edits (rename /
// deactivate / reorder all survive a redeploy).
addOnSchema.statics.initializeDefaults = async function () {
  const defaults = [
    {
      key: 'premium_detergent', name: 'Premium Detergent', sortOrder: 1,
      translations: { es: 'Detergente premium', pt: 'Detergente premium', de: 'Premium-Waschmittel' }
    },
    {
      key: 'fabric_softener', name: 'Fabric Softener', sortOrder: 2,
      translations: { es: 'Suavizante de telas', pt: 'Amaciante de roupas', de: 'Weichspüler' }
    },
    {
      key: 'stain_remover', name: 'Stain Remover', sortOrder: 3,
      translations: { es: 'Quitamanchas', pt: 'Removedor de manchas', de: 'Fleckenentferner' }
    }
  ];
  for (const def of defaults) {
    await this.findOneAndUpdate(
      { key: def.key },
      { $setOnInsert: { ...def, isActive: true } },
      { upsert: true, new: true }
    );
  }
};

const AddOn = mongoose.model('AddOn', addOnSchema);

module.exports = AddOn;
