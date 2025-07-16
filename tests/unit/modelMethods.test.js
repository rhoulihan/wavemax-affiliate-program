const mongoose = require('mongoose');
const Administrator = require('../../server/models/Administrator');
const Operator = require('../../server/models/Operator');
const Payment = require('../../server/models/Payment');
const DataDeletionRequest = require('../../server/models/DataDeletionRequest');
const encryptionUtil = require('../../server/utils/encryption');

describe('Model Methods', () => {
  describe('Administrator Model', () => {
    describe('setPassword method', () => {
      let admin;
      
      beforeEach(() => {
        admin = new Administrator({
          firstName: 'Test',
          lastName: 'Admin',
          email: 'test@example.com'
        });
      });
      
      it('should set password hash and salt for new admin', () => {
        admin.setPassword('TestPassword123!');
        
        expect(admin.passwordHash).toBeDefined();
        expect(admin.passwordSalt).toBeDefined();
        expect(admin.passwordHash).not.toBe('TestPassword123!');
        expect(admin.passwordHistory).toEqual([]);
      });
      
      it('should add previous password to history when changing password', () => {
        // Set initial password
        admin.setPassword('OldPassword123!');
        const oldHash = admin.passwordHash;
        const oldSalt = admin.passwordSalt;
        
        // Change password
        admin.setPassword('NewPassword123!');
        
        expect(admin.passwordHistory).toHaveLength(1);
        expect(admin.passwordHistory[0].passwordHash).toBe(oldHash);
        expect(admin.passwordHistory[0].passwordSalt).toBe(oldSalt);
        expect(admin.passwordHistory[0].changedAt).toBeInstanceOf(Date);
      });
      
      it('should keep only last 5 passwords in history', () => {
        // Add 6 passwords to history
        admin.passwordHistory = [];
        for (let i = 1; i <= 5; i++) {
          admin.passwordHistory.push({
            passwordHash: `hash${i}`,
            passwordSalt: `salt${i}`,
            changedAt: new Date()
          });
        }
        
        // Set current password
        admin.passwordHash = 'currentHash';
        admin.passwordSalt = 'currentSalt';
        
        // Change password (should push current to history and trim oldest)
        admin.setPassword('NewPassword123!');
        
        expect(admin.passwordHistory).toHaveLength(5);
        expect(admin.passwordHistory[0].passwordHash).toBe('hash2'); // hash1 should be removed
        expect(admin.passwordHistory[4].passwordHash).toBe('currentHash');
      });
      
      it('should handle undefined password history', () => {
        admin.passwordHash = 'existingHash';
        admin.passwordSalt = 'existingSalt';
        admin.passwordHistory = undefined;
        
        admin.setPassword('NewPassword123!');
        
        expect(admin.passwordHistory).toHaveLength(1);
        expect(admin.passwordHistory[0].passwordHash).toBe('existingHash');
      });
    });
  });
  
  describe('Operator Model', () => {
    describe('isPasswordInHistory method', () => {
      let operator;
      
      beforeEach(() => {
        operator = new Operator({
          firstName: 'Test',
          lastName: 'Operator',
          email: 'operator@example.com',
          username: 'testop',
          password: 'password123',
          createdBy: new mongoose.Types.ObjectId()
        });
      });
      
      it('should return false when no password history exists', () => {
        operator.passwordHistory = undefined;
        
        const result = operator.isPasswordInHistory('anypassword');
        
        expect(result).toBe(false);
      });
      
      it('should return false when password history is empty', () => {
        operator.passwordHistory = [];
        
        const result = operator.isPasswordInHistory('anypassword');
        
        expect(result).toBe(false);
      });
      
      it('should return true when password exists in history', () => {
        // Create password history with known password
        const testPassword = 'OldPassword123';
        const salt = Buffer.from('testsalt', 'hex');
        const hash = require('crypto').pbkdf2Sync(testPassword, salt, 100000, 64, 'sha512').toString('hex');
        
        operator.passwordHistory = [{
          hash: hash + ':' + salt.toString('hex'),
          changedAt: new Date()
        }];
        
        const result = operator.isPasswordInHistory(testPassword);
        
        expect(result).toBe(true);
      });
      
      it('should return false when password does not exist in history', () => {
        // Create password history with different password
        const oldPassword = 'OldPassword123';
        const salt = Buffer.from('testsalt', 'hex');
        const hash = require('crypto').pbkdf2Sync(oldPassword, salt, 100000, 64, 'sha512').toString('hex');
        
        operator.passwordHistory = [{
          hash: hash + ':' + salt.toString('hex'),
          changedAt: new Date()
        }];
        
        const result = operator.isPasswordInHistory('DifferentPassword123');
        
        expect(result).toBe(false);
      });
      
      it('should check multiple passwords in history', () => {
        // Create history with multiple passwords
        const passwords = ['Pass1', 'Pass2', 'Pass3'];
        operator.passwordHistory = passwords.map(pwd => {
          const salt = require('crypto').randomBytes(16);
          const hash = require('crypto').pbkdf2Sync(pwd, salt, 100000, 64, 'sha512').toString('hex');
          return {
            hash: hash + ':' + salt.toString('hex'),
            changedAt: new Date()
          };
        });
        
        expect(operator.isPasswordInHistory('Pass2')).toBe(true);
        expect(operator.isPasswordInHistory('Pass4')).toBe(false);
      });
    });
  });
  
  describe('Payment Model', () => {
    describe('pre-save middleware', () => {
      it('should prevent modification of paygistixId after creation', async () => {
        const payment = new Payment({
          orderId: new mongoose.Types.ObjectId(),
          customerId: new mongoose.Types.ObjectId(),
          paymentMethodId: new mongoose.Types.ObjectId(),
          paygistixId: 'PAY123',
          amount: 100
        });
        
        // Mark as not new (simulating existing document)
        payment.isNew = false;
        payment.isModified = (field) => field === 'paygistixId';
        
        let errorThrown = null;
        try {
          await payment.save({ validateBeforeSave: false });
        } catch (error) {
          errorThrown = error;
        }
        
        expect(errorThrown).toBeDefined();
        expect(errorThrown.message).toBe('Paygistix ID cannot be modified');
      });
      
      it('should prevent modification of orderId after creation', async () => {
        const payment = new Payment({
          orderId: new mongoose.Types.ObjectId(),
          customerId: new mongoose.Types.ObjectId(),
          paymentMethodId: new mongoose.Types.ObjectId(),
          paygistixId: 'PAY123',
          amount: 100
        });
        
        // Mark as not new (simulating existing document)
        payment.isNew = false;
        payment.isModified = (field) => field === 'orderId';
        
        let errorThrown = null;
        try {
          await payment.save({ validateBeforeSave: false });
        } catch (error) {
          errorThrown = error;
        }
        
        expect(errorThrown).toBeDefined();
        expect(errorThrown.message).toBe('Order ID cannot be modified');
      });
      
      it('should allow modification of other fields', (done) => {
        const payment = new Payment({
          orderId: new mongoose.Types.ObjectId(),
          customerId: new mongoose.Types.ObjectId(),
          paymentMethodId: new mongoose.Types.ObjectId(),
          paygistixId: 'PAY123',
          amount: 100
        });
        
        // Mark as not new but modifying different field
        payment.isNew = false;
        payment.isModified = (field) => field === 'status';
        
        // Call pre-save middleware directly
        const preSaveMiddleware = payment.schema.s.hooks._pres.get('save')[0].fn;
        preSaveMiddleware.call(payment, (error) => {
          expect(error).toBeUndefined();
          done();
        });
      });
    });
  });
  
  describe('DataDeletionRequest Model', () => {
    describe('markAsFailed method', () => {
      it('should mark request as failed with errors', async () => {
        const request = new DataDeletionRequest({
          facebookUserId: 'FB123',
          confirmationCode: 'CODE123',
          userType: 'affiliate',
          signedRequest: 'signed_request_data'
        });
        
        const errors = ['Error 1', 'Error 2'];
        
        // Mock save method
        request.save = jest.fn().mockResolvedValue(request);
        
        await request.markAsFailed(errors);
        
        expect(request.status).toBe('failed');
        expect(request.deletionDetails.errors).toEqual(errors);
        expect(request.save).toHaveBeenCalled();
      });
      
      it('should mark request as failed without errors', async () => {
        const request = new DataDeletionRequest({
          facebookUserId: 'FB123',
          confirmationCode: 'CODE123',
          userType: 'affiliate',
          signedRequest: 'signed_request_data'
        });
        
        // Mock save method
        request.save = jest.fn().mockResolvedValue(request);
        
        await request.markAsFailed();
        
        expect(request.status).toBe('failed');
        expect(request.deletionDetails.errors).toEqual([]);
        expect(request.save).toHaveBeenCalled();
      });
    });
    
    describe('findStaleRequests static method', () => {
      beforeEach(() => {
        // Mock the find method
        DataDeletionRequest.find = jest.fn();
      });
      
      it('should find pending requests older than default 24 hours', () => {
        const mockDate = new Date('2024-01-01T12:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        DataDeletionRequest.findStaleRequests();
        
        const expectedCutoff = new Date('2023-12-31T12:00:00Z'); // 24 hours before
        
        expect(DataDeletionRequest.find).toHaveBeenCalledWith({
          status: 'pending',
          requestedAt: { $lt: expectedCutoff }
        });
        
        global.Date.mockRestore();
      });
      
      it('should find pending requests older than specified hours', () => {
        const mockDate = new Date('2024-01-01T12:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        DataDeletionRequest.findStaleRequests(48);
        
        const expectedCutoff = new Date('2023-12-30T12:00:00Z'); // 48 hours before
        
        expect(DataDeletionRequest.find).toHaveBeenCalledWith({
          status: 'pending',
          requestedAt: { $lt: expectedCutoff }
        });
        
        global.Date.mockRestore();
      });
      
      it('should handle zero hours parameter', () => {
        const mockDate = new Date('2024-01-01T12:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        DataDeletionRequest.findStaleRequests(0);
        
        expect(DataDeletionRequest.find).toHaveBeenCalledWith({
          status: 'pending',
          requestedAt: { $lt: mockDate }
        });
        
        global.Date.mockRestore();
      });
    });
  });
});