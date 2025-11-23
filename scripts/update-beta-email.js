#!/usr/bin/env node
/**
 * Update beta request email from yahoo.com to gmail.com for pablo
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BetaRequest = require('../server/models/BetaRequest');

async function updateEmail() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wavemax');
    console.log('Connected successfully.\n');

    // Find the beta request
    const betaRequest = await BetaRequest.findOne({ email: 'pablo.ranlettlopez@yahoo.com' });

    if (!betaRequest) {
      console.log('Beta request not found for pablo.ranlettlopez@yahoo.com');
      await mongoose.connection.close();
      return;
    }

    console.log('Found beta request:');
    console.log('ID:', betaRequest._id);
    console.log('Name:', betaRequest.firstName, betaRequest.lastName);
    console.log('Email:', betaRequest.email);
    console.log('Status:', betaRequest.status);
    console.log('Welcome Email Sent:', betaRequest.welcomeEmailSent);
    console.log('');

    // Update the email
    betaRequest.email = 'pablo.ranlettlopez@gmail.com';
    await betaRequest.save();

    console.log('✓ Email updated successfully to pablo.ranlettlopez@gmail.com');
    console.log('');

    // Verify the update
    const updated = await BetaRequest.findOne({ email: 'pablo.ranlettlopez@gmail.com' });
    console.log('Verified updated record:');
    console.log('ID:', updated._id);
    console.log('Email:', updated.email);
    console.log('Welcome Email Sent:', updated.welcomeEmailSent);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

updateEmail().then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
