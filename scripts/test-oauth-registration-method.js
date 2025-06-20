const mongoose = require('mongoose');
const Affiliate = require('../server/models/Affiliate');
require('dotenv').config();

async function testOAuthAffiliates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all OAuth affiliates
    const oauthAffiliates = await Affiliate.find({
      registrationMethod: { $ne: 'traditional' }
    }).select('affiliateId firstName lastName email registrationMethod');

    console.log('\n=== OAuth Affiliates ===');
    console.log(`Total OAuth affiliates found: ${oauthAffiliates.length}`);

    oauthAffiliates.forEach(affiliate => {
      console.log(`\nAffiliate: ${affiliate.firstName} ${affiliate.lastName}`);
      console.log(`Email: ${affiliate.email}`);
      console.log(`ID: ${affiliate.affiliateId}`);
      console.log(`Registration Method: ${affiliate.registrationMethod}`);
    });

    // Find affiliates with no registration method set
    const noMethodAffiliates = await Affiliate.find({
      registrationMethod: { $exists: false }
    }).select('affiliateId firstName lastName email');

    console.log('\n\n=== Affiliates without registrationMethod ===');
    console.log(`Found: ${noMethodAffiliates.length}`);

    noMethodAffiliates.forEach(affiliate => {
      console.log(`\nAffiliate: ${affiliate.firstName} ${affiliate.lastName}`);
      console.log(`Email: ${affiliate.email}`);
      console.log(`ID: ${affiliate.affiliateId}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\nDatabase connection closed');
  }
}

testOAuthAffiliates();