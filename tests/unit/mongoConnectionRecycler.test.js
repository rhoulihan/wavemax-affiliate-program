// Unit tests for the periodic MongoDB connection recycler.
//
// Root cause of the intermittent Oracle-ADB cursor errors is degraded
// long-lived pooled connections against the loadBalanced ADB endpoint; fresh
// connections never fail. This recycler periodically closes and re-opens the
// mongoose pool in every PM2 worker, staggered by worker instance so the
// cluster never resets all workers at once. mongoose's command buffering (and
// the cursor-retry shim) cover the brief reconnect window.

const { startConnectionRecycler } = require('../../server/utils/mongoConnectionRecycler');

function makeMongoose() {
  const order = [];
  return {
    order,
    connection: { close: jest.fn(async () => { order.push('close'); }) },
    connect: jest.fn(async () => { order.push('connect'); })
  };
}

const noopLogger = { info: () => {}, warn: () => {}, error: () => {} };

describe('mongoConnectionRecycler', () => {
  test('recycleOnce closes the pool then reconnects with the same uri/options', async () => {
    const mongoose = makeMongoose();
    const opts = { tls: true, maxIdleTimeMS: 60000 };
    const { recycleOnce } = startConnectionRecycler({
      mongoose, uri: 'mongodb://x/db', options: opts, logger: noopLogger,
      setTimeoutFn: () => {}, setIntervalFn: () => {}
    });
    await recycleOnce();
    expect(mongoose.connection.close).toHaveBeenCalledWith(false);
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://x/db', opts);
    expect(mongoose.order).toEqual(['close', 'connect']); // close BEFORE reconnect
  });

  test('recycleOnce never throws if close/connect fails (guarded, logs error)', async () => {
    const mongoose = makeMongoose();
    mongoose.connection.close = jest.fn(async () => { throw new Error('boom'); });
    const errs = [];
    const { recycleOnce } = startConnectionRecycler({
      mongoose, uri: 'mongodb://x/db', logger: { info: () => {}, warn: () => {}, error: (m, e) => errs.push(m) },
      setTimeoutFn: () => {}, setIntervalFn: () => {}
    });
    await expect(recycleOnce()).resolves.toBeUndefined();
    expect(mongoose.connect).not.toHaveBeenCalled(); // never reconnect after a failed close
    expect(errs.length).toBe(1);
  });

  test('first run fires after a full interval + per-worker stagger (never at startup)', () => {
    const mongoose = makeMongoose();
    let scheduledDelay = null;
    startConnectionRecycler({
      mongoose, uri: 'mongodb://x/db', logger: noopLogger,
      instance: 2, staggerMs: 1000, intervalMs: 600000,
      setTimeoutFn: (fn, ms) => { scheduledDelay = ms; },
      setIntervalFn: () => {}
    });
    // intervalMs (600000) + instance*staggerMs (2*1000) — NOT 0, so no startup race.
    expect(scheduledDelay).toBe(602000);
  });

  test('throws if mongoose or uri is missing', () => {
    expect(() => startConnectionRecycler({ uri: 'x' })).toThrow();
    expect(() => startConnectionRecycler({ mongoose: makeMongoose() })).toThrow();
  });
});
