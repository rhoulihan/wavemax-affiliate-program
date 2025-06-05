/**
 * Migration script to add new delivery fee structure to SystemConfig
 * This adds minimum delivery fee and per-bag fee configuration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');

async function addDeliveryFeeStructure() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if configs already exist
    const existingMinFee = await SystemConfig.findOne({ key: 'delivery_minimum_fee' });
    const existingPerBagFee = await SystemConfig.findOne({ key: 'delivery_per_bag_fee' });

    // Add minimum delivery fee config
    if (!existingMinFee) {
      const minFeeConfig = await SystemConfig.create({
        key: 'delivery_minimum_fee',
        value: 10.00,
        defaultValue: 10.00,
        description: 'Minimum delivery fee regardless of bag count (one-way)',
        category: 'payment',
        dataType: 'number',
        validation: { min: 0.00, max: 100.00 },
        isPublic: true
      });
      console.log('✅ Added delivery_minimum_fee config:', minFeeConfig.value);
    } else {
      console.log('ℹ️  delivery_minimum_fee already exists:', existingMinFee.value);
    }

    // Add per-bag delivery fee config
    if (!existingPerBagFee) {
      const perBagConfig = await SystemConfig.create({
        key: 'delivery_per_bag_fee',
        value: 2.00,
        defaultValue: 2.00,
        description: 'Additional fee per bag for delivery (one-way)',
        category: 'payment',
        dataType: 'number',
        validation: { min: 0.00, max: 20.00 },
        isPublic: true
      });
      console.log('✅ Added delivery_per_bag_fee config:', perBagConfig.value);
    } else {
      console.log('ℹ️  delivery_per_bag_fee already exists:', existingPerBagFee.value);
    }

    // Show current delivery-related configs
    console.log('\n📊 Current delivery fee configuration:');
    const deliveryConfigs = await SystemConfig.find({ 
      key: { $regex: 'delivery' } 
    }).sort('key');
    
    deliveryConfigs.forEach(config => {
      console.log(`   ${config.key}: $${config.value.toFixed(2)} - ${config.description}`);
    });

    console.log('\n✅ Delivery fee structure migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
addDeliveryFeeStructure();