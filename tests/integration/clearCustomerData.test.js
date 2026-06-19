// Integration test for scripts/admin/clear-customer-data.js
//
// The script hard-deletes all bags / orders / customers and cleans the records
// that reference them (Transaction entries pointing at deleted orders, and
// customer-scoped RefreshToken / TokenBlacklist). It must NOT touch records
// belonging to affiliates / operators / administrators, and a dry-run must
// delete nothing.
const mongoose = require('mongoose');
const Order = require('../../server/models/Order');
const Customer = require('../../server/models/Customer');
const Bag = require('../../server/modules/bags/Bag');
const Transaction = require('../../server/models/Transaction');
const RefreshToken = require('../../server/models/RefreshToken');
const TokenBlacklist = require('../../server/models/TokenBlacklist');
const { clearCustomerData, decideMode } = require('../../scripts/admin/clear-customer-data');

// Seed via the raw collection so we bypass schema validation and control the
// exact shape (we only care about the fields the clear filters match on).
async function seed() {
  const soon = new Date(Date.now() + 10 * 60 * 1000);
  await Customer.collection.insertMany([
    { customerId: 'CUST-a', affiliateId: 'AFF-1', email: 'a@example.com', phone: '5551112222' },
    { customerId: 'CUST-b', affiliateId: 'AFF-1', email: 'b@example.com', phone: '5553334444' }
  ]);
  await Bag.collection.insertMany([
    { bagId: 'BAG-a', affiliateId: 'AFF-1', customerId: 'CUST-a', status: 'active', tokenHash: 'h1', token: 't1' },
    { bagId: 'BAG-b', affiliateId: 'AFF-1', customerId: 'CUST-b', status: 'active', tokenHash: 'h2', token: 't2' }
  ]);
  await Order.collection.insertMany([
    { orderId: 'ORD-a', customerId: 'CUST-a', affiliateId: 'AFF-1', bagId: 'BAG-a', bagToken: 't1', status: 'pending' },
    { orderId: 'ORD-b', customerId: 'CUST-b', affiliateId: 'AFF-1', bagId: 'BAG-b', bagToken: 't2', status: 'complete' }
  ]);
  await Transaction.collection.insertMany([
    { transactionId: 'TXN-1', affiliateId: 'AFF-1', orders: ['ORD-a', 'ORD-b'] }, // references deleted orders -> cleaned
    { transactionId: 'TXN-2', affiliateId: 'AFF-1', orders: [] }                  // no order ref -> must survive
  ]);
  await RefreshToken.collection.insertMany([
    { userId: new mongoose.Types.ObjectId(), userType: 'customer', token: 'r1', expiryDate: soon },
    { userId: new mongoose.Types.ObjectId(), userType: 'affiliate', token: 'r2', expiryDate: soon } // must survive
  ]);
  await TokenBlacklist.collection.insertMany([
    { userId: 'x', userType: 'customer', token: 'b1', expiresAt: soon },
    { userId: 'y', userType: 'administrator', token: 'b2', expiresAt: soon } // must survive
  ]);
}

describe('clear-customer-data script', () => {
  it('dry-run reports what WOULD be deleted but deletes nothing', async () => {
    await seed();
    const report = await clearCustomerData({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.results.orders.matched).toBe(2);
    expect(report.results.customers.matched).toBe(2);
    expect(report.results.bags.matched).toBe(2);
    expect(report.results.transactions.matched).toBe(1); // only the order-referencing one
    expect(report.results.refreshTokens.matched).toBe(1); // only the customer one
    expect(report.results.tokenBlacklist.matched).toBe(1); // only the customer one
    // dry-run records zero deletions
    Object.values(report.results).forEach((r) => expect(r.deleted).toBe(0));

    // nothing actually removed
    expect(await Order.countDocuments()).toBe(2);
    expect(await Customer.countDocuments()).toBe(2);
    expect(await Bag.countDocuments()).toBe(2);
    expect(await Transaction.countDocuments()).toBe(2);
    expect(await RefreshToken.countDocuments()).toBe(2);
    expect(await TokenBlacklist.countDocuments()).toBe(2);
  });

  it('execute deletes all bags/orders/customers and cleans referencing records, leaving others intact', async () => {
    await seed();
    const report = await clearCustomerData({ dryRun: false });

    expect(report.dryRun).toBe(false);
    expect(report.results.orders.deleted).toBe(2);
    expect(report.results.customers.deleted).toBe(2);
    expect(report.results.bags.deleted).toBe(2);
    expect(report.results.transactions.deleted).toBe(1);
    expect(report.results.refreshTokens.deleted).toBe(1);
    expect(report.results.tokenBlacklist.deleted).toBe(1);

    // targets fully emptied
    expect(await Order.countDocuments()).toBe(0);
    expect(await Customer.countDocuments()).toBe(0);
    expect(await Bag.countDocuments()).toBe(0);

    // order-referencing transaction removed; order-less one survives
    expect(await Transaction.countDocuments()).toBe(1);
    expect(await Transaction.countDocuments({ 'orders.0': { $exists: true } })).toBe(0);

    // customer-scoped tokens removed; affiliate / admin tokens survive
    expect(await RefreshToken.countDocuments()).toBe(1);
    expect(await RefreshToken.countDocuments({ userType: 'affiliate' })).toBe(1);
    expect(await TokenBlacklist.countDocuments()).toBe(1);
    expect(await TokenBlacklist.countDocuments({ userType: 'administrator' })).toBe(1);
  });

  it('execute on an empty database is a no-op (zero deletions)', async () => {
    const report = await clearCustomerData({ dryRun: false });
    Object.values(report.results).forEach((r) => {
      expect(r.matched).toBe(0);
      expect(r.deleted).toBe(0);
    });
  });

  // Safety-critical: calling the helper with NO args must be a dry-run that
  // deletes nothing. A regression flipping the default to delete-by-default
  // would otherwise pass every other test while silently wiping prod.
  it('defaults to dry-run when called with no arguments (deletes nothing)', async () => {
    await seed();
    const report = await clearCustomerData();
    expect(report.dryRun).toBe(true);
    Object.values(report.results).forEach((r) => expect(r.deleted).toBe(0));
    // data untouched
    expect(await Order.countDocuments()).toBe(2);
    expect(await Customer.countDocuments()).toBe(2);
    expect(await Bag.countDocuments()).toBe(2);
  });
});

describe('clear-customer-data decideMode (CLI arg parsing)', () => {
  it('no flag => dry-run (the safe default)', () => {
    expect(decideMode([])).toEqual({ dryRun: true, execute: false });
    expect(decideMode()).toEqual({ dryRun: true, execute: false });
  });

  it('--yes / --confirm => execute', () => {
    expect(decideMode(['--yes'])).toEqual({ dryRun: false, execute: true });
    expect(decideMode(['--confirm'])).toEqual({ dryRun: false, execute: true });
    expect(decideMode(['foo', '--yes', 'bar'])).toEqual({ dryRun: false, execute: true });
  });

  it('unrecognized / wrong-case flags never trigger a delete', () => {
    // case-sensitive on purpose: '--YES' must fall through to safe dry-run
    expect(decideMode(['--YES'])).toEqual({ dryRun: true, execute: false });
    expect(decideMode(['--force'])).toEqual({ dryRun: true, execute: false });
    expect(decideMode(['-y'])).toEqual({ dryRun: true, execute: false });
  });
});
