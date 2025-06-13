#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateLaundryBagFee() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const dbName = process.env.DB_NAME || 'wavemax';
    
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db(dbName);
        const systemConfigCollection = db.collection('systemconfigs');
        
        // First, let's find the current laundry bag fee configuration
        const currentConfig = await systemConfigCollection.findOne({ 
            key: 'laundry_bag_fee' 
        });
        
        if (currentConfig) {
            console.log('\nCurrent laundry bag fee configuration:');
            console.log(JSON.stringify(currentConfig, null, 2));
            
            // Update the laundry bag fee to $10.00
            const updateResult = await systemConfigCollection.updateOne(
                { key: 'laundry_bag_fee' },
                { 
                    $set: { 
                        value: 10.00,
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log('\nUpdate result:', updateResult);
            
            // Fetch and display the updated configuration
            const updatedConfig = await systemConfigCollection.findOne({ 
                key: 'laundry_bag_fee' 
            });
            
            console.log('\nUpdated laundry bag fee configuration:');
            console.log(JSON.stringify(updatedConfig, null, 2));
            
            if (updatedConfig.value === 10.00) {
                console.log('\n✓ Successfully updated laundry bag fee to $10.00');
            } else {
                console.log('\n✗ Failed to update laundry bag fee');
            }
        } else {
            console.log('\n✗ Laundry bag fee configuration not found in SystemConfig collection');
            
            // Let's check what configurations exist
            const allConfigs = await systemConfigCollection.find({}).toArray();
            console.log('\nAvailable configurations:');
            allConfigs.forEach(config => {
                console.log(`- ${config.key}: ${config.value || config.defaultValue}`);
            });
        }
        
    } catch (error) {
        console.error('Error updating laundry bag fee:', error);
    } finally {
        await client.close();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the update
updateLaundryBagFee();