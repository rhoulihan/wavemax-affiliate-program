// MongoDB Initialization Script
// This script will create the necessary collections and indexes
// for the WaveMAX Laundry Affiliate Program

db = db.getSiblingDB('wavemax');

// Create collections
db.createCollection('affiliates');
db.createCollection('customers');
db.createCollection('orders');
db.createCollection('bags');
db.createCollection('transactions');

// Create indexes for affiliates collection
db.affiliates.createIndex({ "affiliateId": 1 }, { unique: true });
db.affiliates.createIndex({ "email": 1 }, { unique: true });
db.affiliates.createIndex({ "username": 1 }, { unique: true });
db.affiliates.createIndex({ "phone": 1 });
db.affiliates.createIndex({ "zipCode": 1 });
db.affiliates.createIndex({ "isActive": 1 });

// Create indexes for customers collection
db.customers.createIndex({ "customerId": 1 }, { unique: true });
db.customers.createIndex({ "email": 1 }, { unique: true });
db.customers.createIndex({ "username": 1 }, { unique: true });
db.customers.createIndex({ "affiliateId": 1 });
db.customers.createIndex({ "phone": 1 });
db.customers.createIndex({ "zipCode": 1 });
db.customers.createIndex({ "isActive": 1 });
db.customers.createIndex({ "registrationDate": 1 });
db.customers.createIndex({ "bags.bagId": 1 });

// Create indexes for orders collection
db.orders.createIndex({ "orderId": 1 }, { unique: true });
db.orders.createIndex({ "customerId": 1 });
db.orders.createIndex({ "affiliateId": 1 });
db.orders.createIndex({ "status": 1 });
db.orders.createIndex({ "pickupDate": 1 });
db.orders.createIndex({ "deliveryDate": 1 });
db.orders.createIndex({ "createdAt": 1 });
db.orders.createIndex({ "bagIDs": 1 });

// Create indexes for bags collection
db.bags.createIndex({ "bagId": 1 }, { unique: true });
db.bags.createIndex({ "barcode": 1 }, { unique: true });
db.bags.createIndex({ "customerId": 1 });
db.bags.createIndex({ "affiliateId": 1 });
db.bags.createIndex({ "status": 1 });

// Create indexes for transactions collection
db.transactions.createIndex({ "transactionId": 1 }, { unique: true });
db.transactions.createIndex({ "affiliateId": 1 });
db.transactions.createIndex({ "status": 1 });
db.transactions.createIndex({ "payoutDate": 1 });
db.transactions.createIndex({ "createdAt": 1 });

// Insert a demo affiliate account
db.affiliates.insertOne({
    "affiliateId": "AFF123456",
    "firstName": "Demo",
    "lastName": "Affiliate",
    "email": "demo.affiliate@example.com",
    "phone": "(555) 123-4567",
    "businessName": "Demo Delivery Service",
    "address": "123 Main Street",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "serviceArea": "Downtown Austin, South Congress, Zilker",
    "deliveryFee": 5.99,
    "username": "demoaffiliate",
    // Secure password hash will be generated on first run
    "passwordSalt": "",
    "passwordHash": "",
    "paymentMethod": "directDeposit",
    "isActive": true,
    "dateRegistered": new Date(),
    "createdAt": new Date(),
    "updatedAt": new Date()
});

// Insert a demo customer account
db.customers.insertOne({
    "customerId": "CUST123456",
    "affiliateId": "AFF123456",
    "firstName": "Demo",
    "lastName": "Customer",
    "email": "demo.customer@example.com",
    "phone": "(555) 987-6543",
    "address": "456 Oak Avenue",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78704",
    "deliveryInstructions": "Leave packages at the door",
    "serviceFrequency": "weekly",
    "preferredDay": "monday",
    "preferredTime": "afternoon",
    "specialInstructions": "Please separate whites and colors",
    "username": "democustomer",
    // Password: password123
    "passwordSalt": "f844b09ff50c61d8e1b17f5e9fdfb53d",
    "passwordHash": "7faa96b2b554e25893e785ee973290a53996ef8bbf0535a0acbbdbea8a1dd8bd7683d9a3f8431d84d16a036fc70ed8dde3b73bbf2632f94c4db3d621f3c5a3b",
    "lastFourDigits": "1234",
    "billingZip": "78704",
    "savePaymentInfo": true,
    "isActive": true,
    "registrationDate": new Date(),
    "bags": [
        {
            "bagId": "BAG123456",
            "barcode": "WM-ABCD1234",
            "issuedDate": new Date(),
            "isActive": true
        }
    ],
    "createdAt": new Date(),
    "updatedAt": new Date()
});

// Insert a demo bag
db.bags.insertOne({
    "bagId": "BAG123456",
    "barcode": "WM-ABCD1234",
    "customerId": "CUST123456",
    "affiliateId": "AFF123456",
    "status": "assigned",
    "issueDate": new Date(),
    "createdAt": new Date(),
    "updatedAt": new Date()
});

// Insert a demo order
db.orders.insertOne({
    "orderId": "ORD123456",
    "customerId": "CUST123456",
    "affiliateId": "AFF123456",
    "pickupDate": new Date(new Date().setDate(new Date().getDate() + 1)),
    "pickupTime": "afternoon",
    "specialPickupInstructions": "Ring doorbell",
    "estimatedSize": "medium",
    "serviceNotes": "Please be gentle with delicates",
    "deliveryDate": new Date(new Date().setDate(new Date().getDate() + 3)),
    "deliveryTime": "afternoon",
    "specialDeliveryInstructions": "Leave at front door",
    "status": "scheduled",
    "baseRate": 1.89,
    "deliveryFee": 5.99,
    "estimatedTotal": 49.46,
    "paymentStatus": "pending",
    "paymentMethod": "card",
    "scheduledAt": new Date(),
    "createdAt": new Date(),
    "updatedAt": new Date()
});

print("Database initialization completed successfully!");