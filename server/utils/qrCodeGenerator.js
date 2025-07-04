// QR Code Generator Utility
const crypto = require('crypto');

/**
 * Generate a unique QR code for a customer or order
 * @param {string} type - 'customer' or 'order'
 * @param {string} id - Optional ID to include in the QR code
 * @returns {string} - Unique QR code string
 */
function generateQRCode(type = 'customer', id = null) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    if (id) {
        return `WAVEMAX:${type.toUpperCase()}:${id}:${random}`;
    } else {
        return `WAVEMAX:${type.toUpperCase()}:${timestamp}:${random}`;
    }
}

module.exports = {
    generateQRCode
};