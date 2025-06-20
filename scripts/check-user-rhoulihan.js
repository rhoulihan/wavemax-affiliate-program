#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const Customer = require('../server/models/Customer');
const Affiliate = require('../server/models/Affiliate');
const Administrator = require('../server/models/Administrator');
const Operator = require('../server/models/Operator');

async function checkUserInCollections() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax-laundry';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully\n');

    const username = 'rhoulihan';
    console.log(`Searching for user with username: ${username}\n`);

    // Check in Customer collection
    console.log('Checking Customer collection...');
    const customer = await Customer.findOne({ username: username });
    if (customer) {
      console.log('✓ Found in Customer collection:');
      console.log(`  - ID: ${customer._id}`);
      console.log(`  - Username: ${customer.username}`);
      console.log(`  - Email: ${customer.email}`);
      console.log(`  - Name: ${customer.firstName} ${customer.lastName}`);
      console.log(`  - Phone: ${customer.phone}`);
      console.log(`  - Created: ${customer.createdAt}`);
    } else {
      console.log('✗ Not found in Customer collection');
    }

    // Check in Affiliate collection
    console.log('\nChecking Affiliate collection...');
    const affiliate = await Affiliate.findOne({ username: username });
    if (affiliate) {
      console.log('✓ Found in Affiliate collection:');
      console.log(`  - ID: ${affiliate._id}`);
      console.log(`  - Username: ${affiliate.username}`);
      console.log(`  - Email: ${affiliate.email}`);
      console.log(`  - Company: ${affiliate.companyName}`);
      console.log(`  - Contact: ${affiliate.contactName}`);
      console.log(`  - Phone: ${affiliate.phone}`);
      console.log(`  - Status: ${affiliate.status}`);
      console.log(`  - Created: ${affiliate.createdAt}`);
    } else {
      console.log('✗ Not found in Affiliate collection');
    }

    // Check in Administrator collection
    console.log('\nChecking Administrator collection...');
    const administrator = await Administrator.findOne({ username: username });
    if (administrator) {
      console.log('✓ Found in Administrator collection:');
      console.log(`  - ID: ${administrator._id}`);
      console.log(`  - Username: ${administrator.username}`);
      console.log(`  - Email: ${administrator.email}`);
      console.log(`  - Name: ${administrator.name}`);
      console.log(`  - Role: ${administrator.role}`);
      console.log(`  - Created: ${administrator.createdAt}`);
    } else {
      console.log('✗ Not found in Administrator collection');
    }

    // Check in Operator collection
    console.log('\nChecking Operator collection...');
    const operator = await Operator.findOne({ username: username });
    if (operator) {
      console.log('✓ Found in Operator collection:');
      console.log(`  - ID: ${operator._id}`);
      console.log(`  - Username: ${operator.username}`);
      console.log(`  - Email: ${operator.email}`);
      console.log(`  - Name: ${operator.firstName} ${operator.lastName}`);
      console.log(`  - Phone: ${operator.phone}`);
      console.log(`  - Status: ${operator.status}`);
      console.log(`  - Created: ${operator.createdAt}`);
    } else {
      console.log('✗ Not found in Operator collection');
    }

    // Also check by email pattern in case username field doesn't exist or is different
    console.log('\n\nAlso checking by email pattern (rhoulihan@*)...');

    const emailPattern = /rhoulihan@/i;

    const customerByEmail = await Customer.findOne({ email: emailPattern });
    if (customerByEmail && (!customer || customer._id.toString() !== customerByEmail._id.toString())) {
      console.log('\n✓ Additional Customer found by email:');
      console.log(`  - ID: ${customerByEmail._id}`);
      console.log(`  - Username: ${customerByEmail.username}`);
      console.log(`  - Email: ${customerByEmail.email}`);
      console.log(`  - Name: ${customerByEmail.firstName} ${customerByEmail.lastName}`);
    }

    const affiliateByEmail = await Affiliate.findOne({ email: emailPattern });
    if (affiliateByEmail && (!affiliate || affiliate._id.toString() !== affiliateByEmail._id.toString())) {
      console.log('\n✓ Additional Affiliate found by email:');
      console.log(`  - ID: ${affiliateByEmail._id}`);
      console.log(`  - Username: ${affiliateByEmail.username}`);
      console.log(`  - Email: ${affiliateByEmail.email}`);
      console.log(`  - Company: ${affiliateByEmail.companyName}`);
    }

    const administratorByEmail = await Administrator.findOne({ email: emailPattern });
    if (administratorByEmail && (!administrator || administrator._id.toString() !== administratorByEmail._id.toString())) {
      console.log('\n✓ Additional Administrator found by email:');
      console.log(`  - ID: ${administratorByEmail._id}`);
      console.log(`  - Username: ${administratorByEmail.username}`);
      console.log(`  - Email: ${administratorByEmail.email}`);
      console.log(`  - Name: ${administratorByEmail.name}`);
    }

    const operatorByEmail = await Operator.findOne({ email: emailPattern });
    if (operatorByEmail && (!operator || operator._id.toString() !== operatorByEmail._id.toString())) {
      console.log('\n✓ Additional Operator found by email:');
      console.log(`  - ID: ${operatorByEmail._id}`);
      console.log(`  - Username: ${operatorByEmail.username}`);
      console.log(`  - Email: ${operatorByEmail.email}`);
      console.log(`  - Name: ${operatorByEmail.firstName} ${operatorByEmail.lastName}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the check
checkUserInCollections();