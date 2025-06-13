#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkLaundryBagFee() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
    const dbName = process.env.DB_NAME || 'wavemax';
    
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        
        const db = client.db(dbName);
        const systemConfigCollection = db.collection('systemconfigs');
        
        const config = await systemConfigCollection.findOne({ 
            key: 'laundry_bag_fee' 
        });
        
        if (config) {
            console.log('\n=== Laundry Bag Fee Configuration ===');
            console.log(`Current Value: $${config.value.toFixed(2)}`);
            console.log(`Default Value: $${config.defaultValue.toFixed(2)}`);
            console.log(`Description: ${config.description}`);
            console.log(`Last Updated: ${config.updatedAt}`);
            console.log(`Category: ${config.category}`);
            console.log(`Is Public: ${config.isPublic}`);
            console.log(`Is Editable: ${config.isEditable}`);
            console.log(`Validation Range: $${config.validation.min.toFixed(2)} - $${config.validation.max.toFixed(2)}`);
            console.log('=====================================\n');
        } else {
            console.log('Laundry bag fee configuration not found.');
        }
        
    } catch (error) {
        console.error('Error checking laundry bag fee:', error);
    } finally {
        await client.close();
    }
}

// Run the check
checkLaundryBagFee();