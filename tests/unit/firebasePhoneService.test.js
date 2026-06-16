// firebasePhoneService — verifies Firebase phone ID tokens via Admin SDK (PR 7).
// The Admin SDK is mocked: tests never reach Google.

const mockVerifyIdToken = jest.fn();
jest.mock('firebase-admin', () => ({
  apps: [{ name: '[DEFAULT]' }], // pretend already initialized → init is a no-op
  auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  credential: { cert: jest.fn(() => ({})) },
  initializeApp: jest.fn()
}));

const firebasePhoneService = require('../../server/services/firebasePhoneService');

describe('firebasePhoneService', () => {
  const ORIG = process.env.PHONE_VERIFICATION_ENABLED;
  afterEach(() => {
    process.env.PHONE_VERIFICATION_ENABLED = ORIG;
    mockVerifyIdToken.mockReset();
  });

  describe('isEnabled', () => {
    it('true only when PHONE_VERIFICATION_ENABLED === "true"', () => {
      process.env.PHONE_VERIFICATION_ENABLED = 'true';
      expect(firebasePhoneService.isEnabled()).toBe(true);
      process.env.PHONE_VERIFICATION_ENABLED = 'false';
      expect(firebasePhoneService.isEnabled()).toBe(false);
      delete process.env.PHONE_VERIFICATION_ENABLED;
      expect(firebasePhoneService.isEnabled()).toBe(false);
    });
  });

  describe('verifyPhoneToken', () => {
    it('returns the verified E.164 phone from the decoded token', async () => {
      mockVerifyIdToken.mockResolvedValue({ phone_number: '+15125550101', uid: 'abc' });
      const phone = await firebasePhoneService.verifyPhoneToken('id-token');
      expect(phone).toBe('+15125550101');
      expect(mockVerifyIdToken).toHaveBeenCalledWith('id-token');
    });

    it('rejects when the decoded token carries no phone_number', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'abc' });
      await expect(firebasePhoneService.verifyPhoneToken('id-token')).rejects.toThrow();
    });

    it('rejects when the token is missing', async () => {
      await expect(firebasePhoneService.verifyPhoneToken('')).rejects.toThrow();
    });
  });
});
