/**
 * Build ALL line item fields exactly as Paygistix expects
 * The hash is tied to this exact structure with these exact field names
 */
function buildFixedPaygistixFields(lineItems) {
  // Define the complete form structure with all products
  const formStructure = [
    { index: 1, code: 'MDF10', description: 'Minimum Delivery Fee', price: 10.00 },
    { index: 2, code: 'MDF15', description: 'Minimum Delivery Fee', price: 15.00 },
    { index: 3, code: 'MDF20', description: 'Minimum Delivery Fee', price: 20.00 },
    { index: 4, code: 'MDF25', description: 'Minimum Delivery Fee', price: 25.00 },
    { index: 5, code: 'MDF30', description: 'Minimum Delivery Fee', price: 30.00 },
    { index: 6, code: 'MDF35', description: 'Minimum Delivery Fee', price: 35.00 },
    { index: 7, code: 'MDF40', description: 'Minimum Delivery Fee', price: 40.00 },
    { index: 8, code: 'MDF45', description: 'Minimum Delivery Fee', price: 45.00 },
    { index: 9, code: 'MDF50', description: 'Minimum Delivery Fee', price: 50.00 },
    { index: 10, code: 'PBF5', description: 'Per Bag Fee', price: 5.00 },
    { index: 11, code: 'PBF10', description: 'Per Bag Fee', price: 10.00 },
    { index: 12, code: 'PBF15', description: 'Per Bag Fee', price: 15.00 },
    { index: 13, code: 'PBF20', description: 'Per Bag Fee', price: 20.00 },
    { index: 14, code: 'PBF25', description: 'Per Bag Fee', price: 25.00 },
    { index: 15, code: 'WDF', description: 'Wash Dry Fold', price: 1.25 },
    { index: 16, code: 'WDF1', description: 'Wash Dry Fold (1 Add-on)', price: 1.35 },
    { index: 17, code: 'WDF2', description: 'Wash Dry Fold (2 Add-on)', price: 1.45 },
    { index: 18, code: 'WDF3', description: 'Wash Dry Fold (3 Add-on)', price: 1.55 }
  ];

  // Create a map of our actual line items
  const itemMap = {};
  if (lineItems && lineItems.length > 0) {
    lineItems.forEach(item => {
      itemMap[item.code] = item.quantity || 0;
    });
  }

  // Build ALL fields with quantities set appropriately
  let fieldsHtml = '';
  formStructure.forEach(product => {
    const quantity = itemMap[product.code] || 0;
    fieldsHtml += `
      <input type="hidden" name="pxCode${product.index}" value="${product.code}">
      <input type="hidden" name="pxDescription${product.index}" value="${product.description}">
      <input type="hidden" name="pxPrice${product.index}" value="${product.price}">
      <input type="hidden" name="pxQty${product.index}" value="${quantity}">
    `;
  });

  return fieldsHtml;
}

// Export for use in v2-payment-modal.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = buildFixedPaygistixFields;
}

// Make available globally
window.buildFixedPaygistixFields = buildFixedPaygistixFields;