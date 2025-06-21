#!/usr/bin/env node

// Check affiliate W9 status
require('dotenv').config();
const mongoose = require('mongoose');
const Affiliate = require('../server/models/Affiliate');

async function checkAffiliateW9Status() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find the affiliate that was just updated
    const affiliateId = '6855ef976df661c8974b758d';
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (affiliate) {
      console.log('\nAffiliate W9 Information:');
      console.log('========================');
      console.log('Name:', affiliate.firstName, affiliate.lastName);
      console.log('Email:', affiliate.email);
      console.log('\nW9 Status:', affiliate.w9Information?.status);
      console.log('DocuSign Status:', affiliate.w9Information?.docusignStatus);
      console.log('DocuSign Envelope ID:', affiliate.w9Information?.docusignEnvelopeId);
      console.log('Submitted At:', affiliate.w9Information?.submittedAt);
      console.log('DocuSign Initiated At:', affiliate.w9Information?.docusignInitiatedAt);
      console.log('\nFull W9 Info:', JSON.stringify(affiliate.w9Information, null, 2));
    } else {
      console.log('Affiliate not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAffiliateW9Status();