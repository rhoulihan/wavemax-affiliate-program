const mongoose = require('mongoose');
const Customer = require('../server/models/Customer');
const encryptionUtil = require('../server/utils/encryption');
require('dotenv').config();

async function checkCustomer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    const customer = await Customer.findOne({
      $or: [
        { username: 'Rhoulihan' },
        { email: 'rickh@wavemaxlaundry.com' }
      ]
    });

    if (customer) {
      console.log('Customer found:');
      console.log('- ID:', customer._id);
      console.log('- Customer ID:', customer.customerId);
      console.log('- Username:', customer.username);
      console.log('- Email:', customer.email);
      console.log('- Has passwordHash:', !!customer.passwordHash);
      console.log('- Has passwordSalt:', !!customer.passwordSalt);
      console.log('- passwordHash length:', customer.passwordHash ? customer.passwordHash.length : 0);
      console.log('- passwordSalt length:', customer.passwordSalt ? customer.passwordSalt.length : 0);
      console.log('- Created:', customer.createdAt);

      // Test password verification
      const testPassword = 'R8der50!';
      if (customer.passwordHash && customer.passwordSalt) {
        const isValid = encryptionUtil.verifyPassword(
          testPassword,
          customer.passwordSalt,
          customer.passwordHash
        );
        console.log('\nPassword verification test:');
        console.log('- Testing password:', testPassword);
        console.log('- Password is valid:', isValid);

        // Also test by re-hashing and comparing
        const { salt, hash } = encryptionUtil.hashPassword(testPassword);
        console.log('\nRe-hash test:');
        console.log('- New salt matches stored:', salt === customer.passwordSalt);
        console.log('- New hash matches stored:', hash === customer.passwordHash);
      }
    } else {
      console.log('Customer NOT found with username or email: rhoulihan');

      // Search for any customers with similar usernames
      const similarCustomers = await Customer.find({
        $or: [
          { username: { $regex: 'rhoulihan', $options: 'i' } },
          { email: { $regex: 'rhoulihan', $options: 'i' } }
        ]
      }).limit(5);

      if (similarCustomers.length > 0) {
        console.log('\nFound similar customers:');
        similarCustomers.forEach(c => {
          console.log(`- Username: ${c.username}, Email: ${c.email}, Created: ${c.createdAt}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
  }
}

checkCustomer();