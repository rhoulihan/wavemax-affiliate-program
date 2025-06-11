#!/usr/bin/env node

/**
 * Script to add bag fee configuration to system settings
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('../server/models/SystemConfig');

async function addBagFeeConfig() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Check if bag fee config exists
        const existingConfig = await SystemConfig.findOne({ key: 'bag_fee' });
        
        if (existingConfig) {
            console.log(`Bag fee already configured: $${existingConfig.value}`);
        } else {
            // Create bag fee config
            const bagFeeConfig = new SystemConfig({
                key: 'bag_fee',
                value: '1.00',
                description: 'One-time bag fee for new customer registration',
                category: 'pricing',
                dataType: 'number',
                isPublic: true,
                validationRules: {
                    min: 0,
                    max: 100
                }
            });
            
            await bagFeeConfig.save();
            console.log('Bag fee configuration added: $1.00');
        }
        
        // Display all pricing configurations
        const pricingConfigs = await SystemConfig.find({ category: 'pricing' });
        console.log('\nCurrent pricing configurations:');
        pricingConfigs.forEach(config => {
            console.log(`- ${config.key}: $${config.value} (${config.description})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the script
addBagFeeConfig();