const express = require('express');
const router = express.Router();

// Public endpoint to get payment configuration
router.get('/', (req, res) => {
    try {
        // Get configuration from environment variables
        const config = {
            merchantId: process.env.PAYGISTIX_MERCHANT_ID || 'wmaxaustWEB',
            formId: process.env.PAYGISTIX_FORM_ID || '55015031208',
            formHash: process.env.PAYGISTIX_FORM_HASH || '',
            formActionUrl: process.env.PAYGISTIX_FORM_ACTION_URL || 'https://safepay.paymentlogistics.net/transaction.asp',
            returnUrl: process.env.PAYGISTIX_RETURN_URL || `${req.protocol}://${req.get('host')}/payment-callback-handler.html`
        };
        
        // Check if hash is configured
        if (!config.formHash) {
            return res.status(500).json({
                success: false,
                message: 'Payment form configuration is incomplete. Please contact support.'
            });
        }
        
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        console.error('Error getting payment config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load payment configuration'
        });
    }
});

module.exports = router;