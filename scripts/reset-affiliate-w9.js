#!/usr/bin/env node

// Reset affiliate W9 status for testing
require('dotenv').config();
const mongoose = require('mongoose');
const Affiliate = require('../server/models/Affiliate');

async function resetAffiliateW9() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find the affiliate
    const affiliateId = '6855ef976df661c8974b758d';
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (affiliate) {
      console.log('\nBefore reset:');
      console.log('W9 Status:', affiliate.w9Information?.status);
      console.log('DocuSign Envelope ID:', affiliate.w9Information?.docusignEnvelopeId);
      
      // Reset W9 information
      affiliate.w9Information = {
        status: 'not_submitted',
        quickbooksData: {
          vendorType: '1099 Contractor',
          terms: 'Net 15',
          defaultExpenseAccount: 'Commission Expense'
        }
      };
      
      await affiliate.save();
      
      console.log('\nAfter reset:');
      console.log('W9 Status:', affiliate.w9Information?.status);
      console.log('Ready for new W9 send test');
    } else {
      console.log('Affiliate not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

resetAffiliateW9();