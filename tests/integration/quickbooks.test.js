const request = require('supertest');
const app = require('../../server');
const Affiliate = require('../../server/models/Affiliate');
const Administrator = require('../../server/models/Administrator');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const PaymentExport = require('../../server/models/PaymentExport');
const W9Document = require('../../server/models/W9Document');
const { createTestToken } = require('../helpers/authHelper');

describe('QuickBooks Export Integration Tests', () => {
  let adminToken;
  let testAdmin, testAffiliates, testCustomers, testOrders;

  beforeEach(async () => {
    // Clear collections
    await Affiliate.deleteMany({});
    await Administrator.deleteMany({});
    await Order.deleteMany({});
    await Customer.deleteMany({});
    await PaymentExport.deleteMany({});
    await W9Document.deleteMany({});

    // Create test administrator
    testAdmin = await Administrator.create({
      adminId: 'ADMIN-TEST-001',
      firstName: 'Test',
      lastName: 'Admin',
      email: 'admin@example.com',
      password: 'SecureP@ss4QuickB00ks!'  // Password that doesn't contain username/email and no sequential chars
    });

    adminToken = createTestToken(testAdmin.administratorId || testAdmin._id.toString(), 'administrator');

    // Create test affiliates with different W-9 statuses
    const { hashPassword } = require('../../server/utils/encryption');
    const johnHash = hashPassword('JohnDoeSecure!8');
    const janeHash = hashPassword('JaneSmithSecure!9');
    const bobHash = hashPassword('BobBrownSecure!7');

    testAffiliates = await Promise.all([
      // Verified affiliate 1
      Affiliate.create({
        affiliateId: 'AFF-QB-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        passwordHash: johnHash.hash,
        passwordSalt: johnHash.salt,
        phoneNumber: '+1234567890',
        businessName: 'John Doe LLC',
        address: '123 Test St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        phone: '+1234567890',
        paymentMethod: 'check',
        serviceArea: 'Downtown Austin',
        serviceLatitude: 30.2672,
        serviceLongitude: -97.7431,
        serviceRadius: 10,
        minimumDeliveryFee: 25,
        perBagDeliveryFee: 5,
        w9Information: {
          status: 'verified',
          taxIdType: 'SSN',
          taxIdLast4: '1234',
          businessName: 'John Doe LLC',
          verifiedAt: new Date(),
          quickbooksVendorId: 'QB-VENDOR-001',
          quickbooksData: {
            displayName: 'John Doe LLC',
            vendorType: '1099 Contractor',
            terms: 'Net 15',
            defaultExpenseAccount: 'Commission Expense'
          }
        }
      }),
      // Verified affiliate 2
      Affiliate.create({
        affiliateId: 'AFF-QB-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        username: 'janesmith',
        passwordHash: janeHash.hash,
        passwordSalt: janeHash.salt,
        phoneNumber: '+1234567891',
        businessName: 'Smith Services LLC',
        address: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        phone: '+1234567891',
        paymentMethod: 'check',
        serviceArea: 'Downtown Dallas',
        serviceLatitude: 32.7767,
        serviceLongitude: -96.7970,
        serviceRadius: 15,
        minimumDeliveryFee: 30,
        perBagDeliveryFee: 6,
        w9Information: {
          status: 'verified',
          taxIdType: 'EIN',
          taxIdLast4: '5678',
          businessName: 'Smith Enterprises',
          verifiedAt: new Date(),
          quickbooksData: {
            displayName: 'Smith Enterprises'
          }
        }
      }),
      // Unverified affiliate (should not appear in exports)
      Affiliate.create({
        affiliateId: 'AFF-QB-003',
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob@example.com',
        username: 'bobwilson',
        passwordHash: bobHash.hash,
        passwordSalt: bobHash.salt,
        phoneNumber: '+1234567892',
        phone: '+1234567892',
        address: '789 Elm St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        paymentMethod: 'directDeposit',
        serviceArea: 'Houston Area',
        serviceLatitude: 29.7604,
        serviceLongitude: -95.3698,
        serviceRadius: 20,
        minimumDeliveryFee: 35,
        perBagDeliveryFee: 7,
        w9Information: {
          status: 'pending_review'
        }
      })
    ]);

    // Create test customers
    const custHash1 = hashPassword('Customer1Pass!');
    const custHash2 = hashPassword('Customer2Pass!');

    testCustomers = await Promise.all([
      Customer.create({
        customerId: 'CUST-001',
        firstName: 'Customer',
        lastName: 'One',
        email: 'customer1@example.com',
        username: 'customer1',
        passwordHash: custHash1.hash,
        passwordSalt: custHash1.salt,
        phoneNumber: '+1234567893',
        phone: '+1234567893',
        address: '321 Customer St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78703',
        serviceFrequency: 'weekly',
        affiliateId: 'AFF-QB-001'
      }),
      Customer.create({
        customerId: 'CUST-002',
        firstName: 'Customer',
        lastName: 'Two',
        email: 'customer2@example.com',
        username: 'customer2',
        passwordHash: custHash2.hash,
        passwordSalt: custHash2.salt,
        phoneNumber: '+1234567894',
        phone: '+1234567894',
        address: '654 Customer Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75202',
        serviceFrequency: 'weekly',
        affiliateId: 'AFF-QB-002'
      })
    ]);

    // Create test orders with commissions
    const baseDate = new Date();
    testOrders = await Promise.all([
      // Orders for John Doe (AFF-QB-001)
      Order.create({
        orderId: 'ORD-QB-001',
        customerId: testCustomers[0].customerId,
        affiliateId: testAffiliates[0].affiliateId,
        pickupDate: new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        pickupTime: 'morning',
        estimatedWeight: 15,

        customer: {
          _id: testCustomers[0]._id,
          customerId: testCustomers[0].customerId,
          firstName: testCustomers[0].firstName,
          lastName: testCustomers[0].lastName
        },
        affiliate: {
          affiliateId: testAffiliates[0]._id,
          firstName: testAffiliates[0].firstName,
          lastName: testAffiliates[0].lastName,
          commission: 15.00,
          commissionRate: 10
        },
        services: [{ serviceName: 'Wash & Fold', price: 150.00 }],
        totalPrice: 150.00,
        status: 'complete',
        completedAt: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      }),
      Order.create({
        orderId: 'ORD-QB-002',
        customerId: testCustomers[1].customerId,
        affiliateId: testAffiliates[0].affiliateId,
        pickupDate: new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000),
        pickupTime: 'afternoon',
        estimatedWeight: 20,

        customer: {
          _id: testCustomers[1]._id,
          customerId: testCustomers[1].customerId,
          firstName: testCustomers[1].firstName,
          lastName: testCustomers[1].lastName
        },
        affiliate: {
          affiliateId: testAffiliates[0]._id,
          firstName: testAffiliates[0].firstName,
          lastName: testAffiliates[0].lastName,
          commission: 20.00,
          commissionRate: 10
        },
        services: [{ serviceName: 'Dry Cleaning', price: 200.00 }],
        totalPrice: 200.00,
        status: 'complete',
        completedAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      }),
      // Orders for Jane Smith (AFF-QB-002)
      Order.create({
        orderId: 'ORD-QB-003',
        customerId: testCustomers[0].customerId,
        affiliateId: testAffiliates[1].affiliateId,
        pickupDate: new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000),
        pickupTime: 'evening',
        estimatedWeight: 25,

        customer: {
          _id: testCustomers[0]._id,
          customerId: testCustomers[0].customerId,
          firstName: testCustomers[0].firstName,
          lastName: testCustomers[0].lastName
        },
        affiliate: {
          affiliateId: testAffiliates[1]._id,
          firstName: testAffiliates[1].firstName,
          lastName: testAffiliates[1].lastName,
          commission: 25.00,
          commissionRate: 10
        },
        services: [{ serviceName: 'Commercial Laundry', price: 250.00 }],
        totalPrice: 250.00,
        status: 'complete',
        completedAt: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      }),
      // Order for unverified affiliate (should not appear in payment exports)
      Order.create({
        orderId: 'ORD-QB-004',
        customerId: testCustomers[0].customerId,
        affiliateId: testAffiliates[2].affiliateId,
        pickupDate: new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        pickupTime: 'morning',
        estimatedWeight: 30,

        customer: {
          _id: testCustomers[0]._id,
          customerId: testCustomers[0].customerId
        },
        affiliate: {
          affiliateId: testAffiliates[2]._id,
          commission: 30.00,
          commissionRate: 10
        },
        services: [{ serviceName: 'Wash & Fold', price: 300.00 }],
        totalPrice: 300.00,
        status: 'complete',
        completedAt: new Date()
      })
    ]);
  });

  describe('Vendor Export', () => {
    it('should export verified vendors as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="wavemax-vendors-.*\.csv"/);

      const csvContent = response.text;
      expect(csvContent).toContain('Vendor,Company,Display Name as');
      expect(csvContent).toContain('John Doe,John Doe LLC,John Doe LLC');
      expect(csvContent).toContain('Jane Smith,Smith Enterprises,Smith Enterprises');
      expect(csvContent).not.toContain('Bob Wilson'); // Unverified

      // Verify export was recorded
      const exportRecord = await PaymentExport.findOne({ type: 'vendor' });
      expect(exportRecord).toBeDefined();
      expect(exportRecord.affiliateIds).toHaveLength(2);
    });

    it('should export vendors as JSON', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        export: {
          type: 'vendor',
          exportId: expect.stringMatching(/^EXP-/)
        },
        vendorCount: 2
      });

      const exportRecord = await PaymentExport.findOne({ type: 'vendor' });
      expect(exportRecord.exportData.vendors).toHaveLength(2);
      expect(exportRecord.exportData.vendors[0]).toMatchObject({
        affiliateId: 'AFF-QB-001',
        displayName: 'John Doe LLC',
        taxIdLast4: '1234',
        quickbooksVendorId: 'QB-VENDOR-001'
      });
    });

    it('should handle no verified vendors gracefully', async () => {
      // Remove all verified affiliates
      await Affiliate.updateMany({}, { $set: { 'w9Information.status': 'pending_review' } });

      const response = await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No verified vendors found for export'
      });
    });
  });

  describe('Payment Summary Export', () => {
    it('should export payment summary for date range as CSV', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // 7 days ago
      const endDate = new Date();

      const response = await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          format: 'csv'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');

      const csvContent = response.text;
      expect(csvContent).toContain('Date,Vendor,Account Number,Description,Amount');
      expect(csvContent).toContain('John Doe LLC,AFF-QB-001');
      expect(csvContent).toContain('35.00'); // Total commission for John (15 + 20)
      expect(csvContent).toContain('Smith Enterprises,AFF-QB-002');
      expect(csvContent).toContain('25.00'); // Commission for Jane
      expect(csvContent).not.toContain('AFF-QB-003'); // Unverified affiliate
    });

    it('should export payment summary as JSON with correct aggregations', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          format: 'json'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        export: {
          type: 'payment_summary',
          exportId: expect.stringMatching(/^EXP-/)
        },
        summary: {
          totalAffiliates: 2,
          totalCommissions: 60.00, // 35 + 25
          totalOrders: 3
        }
      });

      const exportRecord = await PaymentExport.findOne({ type: 'payment_summary' });
      expect(exportRecord.exportData.payments).toHaveLength(2);
      expect(exportRecord.exportData.payments.find(p => p.affiliateId === 'AFF-QB-001')).toMatchObject({
        totalCommission: 35.00,
        orderCount: 2
      });
    });

    it('should require date parameters', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('Start date and end date are required');
    });

    it('should handle empty date range', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: futureDate.toISOString().split('T')[0],
          endDate: futureDate.toISOString().split('T')[0]
        })
        .expect(404);

      expect(response.body.message).toContain('No payable commissions found');
    });
  });

  describe('Commission Detail Export', () => {
    it('should export commission details for specific affiliate', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app)
        .get('/api/v1/quickbooks/commission-detail')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          affiliateId: 'AFF-QB-001',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          format: 'csv'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');

      const csvContent = response.text;
      expect(csvContent).toContain('Order ID,Date,Customer,Order Total,Commission Rate,Commission Amount');
      expect(csvContent).toContain('ORD-QB-001');
      expect(csvContent).toContain('ORD-QB-002');
      expect(csvContent).toContain('15.00');
      expect(csvContent).toContain('20.00');
      expect(csvContent).toContain('10%');
    });

    it('should require all parameters', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/commission-detail')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          affiliateId: 'AFF-QB-001',
          startDate: '2025-01-01'
          // Missing endDate
        })
        .expect(400);

      expect(response.body.message).toContain('Affiliate ID, start date, and end date are required');
    });

    it('should reject unverified affiliate export', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/commission-detail')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          affiliateId: 'AFF-QB-003', // Unverified affiliate
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        })
        .expect(400);

      expect(response.body.message).toContain('Affiliate does not have a verified W-9 on file');
    });

    it('should handle non-existent affiliate', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/commission-detail')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          affiliateId: 'AFF-NONEXISTENT',
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        })
        .expect(404);

      expect(response.body.message).toContain('Affiliate not found');
    });
  });

  describe('Export History', () => {
    beforeEach(async () => {
      // Create some exports
      await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' });

      await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          format: 'json'
        });
    });

    it('should retrieve export history', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        exports: expect.arrayContaining([
          expect.objectContaining({
            type: 'vendor',
            exportedBy: {
              firstName: 'Test',
              lastName: 'Admin'
            }
          }),
          expect.objectContaining({
            type: 'payment_summary',
            periodStart: expect.any(String),
            periodEnd: expect.any(String)
          })
        ])
      });
    });

    it('should filter export history by type', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'vendor' })
        .expect(200);

      expect(response.body.exports).toHaveLength(1);
      expect(response.body.exports[0].type).toBe('vendor');
    });

    it('should limit export history results', async () => {
      // Create more exports
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/v1/quickbooks/vendors')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ format: 'json' });
      }

      const response = await request(app)
        .get('/api/v1/quickbooks/history')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ limit: '3' })
        .expect(200);

      expect(response.body.exports).toHaveLength(3);
    });
  });

  describe('Security and Permissions', () => {
    it('should require admin authentication for all QuickBooks endpoints', async () => {
      const endpoints = [
        '/api/v1/quickbooks/vendors',
        '/api/v1/quickbooks/payment-summary',
        '/api/v1/quickbooks/commission-detail',
        '/api/v1/quickbooks/history'
      ];

      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .expect(401);
      }
    });

    it('should not allow affiliate access to QuickBooks exports', async () => {
      const affiliateToken = createTestToken(testAffiliates[0].affiliateId, 'affiliate');

      await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${affiliateToken}`)
        .expect(403);
    });
  });

  describe('CSV Format Validation', () => {
    it('should generate QuickBooks-compatible vendor CSV', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' })
        .expect(200);

      const lines = response.text.split('\n');
      const headers = lines[0].split(',');

      // Verify QuickBooks required columns
      expect(headers).toContain('Vendor');
      expect(headers).toContain('Company');
      expect(headers).toContain('Display Name as');
      expect(headers).toContain('Tax ID');
      expect(headers).toContain('Track payments for 1099');

      // Verify data formatting
      const dataLine = lines[1];
      expect(dataLine).toContain('****1234'); // Masked tax ID
      expect(dataLine).toContain('Yes'); // Track 1099 payments
    });

    it('should generate QuickBooks-compatible payment CSV', async () => {
      const response = await request(app)
        .get('/api/v1/quickbooks/payment-summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          format: 'csv'
        })
        .expect(200);

      const lines = response.text.split('\n');
      const headers = lines[0].split(',');

      // Verify QuickBooks bill/payment columns
      expect(headers).toContain('Date');
      expect(headers).toContain('Vendor');
      expect(headers).toContain('Amount');
      expect(headers).toContain('Expense Account');
      expect(headers).toContain('Memo');
    });
  });
});