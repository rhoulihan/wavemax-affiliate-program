const express = require('express');
const router = express.Router();

/**
 * Get Paygistix configuration for client-side payment forms
 * This endpoint provides non-sensitive configuration values
 */
router.get('/config', (req, res) => {
    try {
        // Only return non-sensitive configuration
        const config = {
            merchantId: process.env.PAYGISTIX_MERCHANT_ID || 'wmaxaustWEB',
            formId: process.env.PAYGISTIX_FORM_ID || '55015031208',
            formHash: process.env.PAYGISTIX_FORM_HASH || '',
            formActionUrl: process.env.PAYGISTIX_FORM_ACTION_URL || 'https://safepay.paymentlogistics.net/transaction.asp',
            environment: process.env.PAYGISTIX_ENVIRONMENT || 'production',
            returnUrl: `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/api/v1/payment_callback`
        };
        
        // Don't send empty hash in production
        if (!config.formHash && process.env.NODE_ENV === 'production') {
            return res.status(500).json({
                success: false,
                message: 'Payment configuration not properly set up'
            });
        }
        
        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Payment config error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment configuration'
        });
    }
});

module.exports = router;