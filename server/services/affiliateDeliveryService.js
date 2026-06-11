// Stub — Task 9 of PR 9 replaces this with the real door-delivery
// confirmation service. Exists so bagActionController's require resolves.

module.exports = {
  confirmDelivery: async () => {
    const e = new Error('Not implemented');
    e.status = 501;
    e.code = 'not_implemented';
    throw e;
  }
};
