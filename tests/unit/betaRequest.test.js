const BetaRequest = require('../../server/models/BetaRequest');

describe('BetaRequest Model', () => {
  describe('Model Creation', () => {
    it('should create a beta request with required fields', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      });

      expect(betaRequest.firstName).toBe('John');
      expect(betaRequest.lastName).toBe('Doe');
      expect(betaRequest.email).toBe('john@example.com');
      expect(betaRequest.welcomeEmailSent).toBe(false);
      expect(betaRequest.reminderEmailCount).toBe(0);
      expect(betaRequest.createdAt).toBeDefined();
      expect(betaRequest.updatedAt).toBeDefined();
    });

    it('should create a beta request with optional fields', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '555-5678',
        businessName: 'Jane Laundry',
        address: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        message: 'Interested in beta testing',
        notes: 'Contacted via phone'
      });

      expect(betaRequest.businessName).toBe('Jane Laundry');
      expect(betaRequest.message).toBe('Interested in beta testing');
      expect(betaRequest.notes).toBe('Contacted via phone');
    });

    it('should lowercase email addresses', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'TEST@EXAMPLE.COM',
        phone: '555-0000',
        address: '789 Test St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001'
      });

      expect(betaRequest.email).toBe('test@example.com');
    });

    it('should uppercase state codes', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-0000',
        address: '789 Test St',
        city: 'Houston',
        state: 'tx',
        zipCode: '77001'
      });

      expect(betaRequest.state).toBe('TX');
    });
  });

  describe('Pre-save Middleware', () => {
    it('should update updatedAt timestamp on save', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-0000',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      });

      const originalUpdatedAt = betaRequest.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      betaRequest.notes = 'Updated notes';
      await betaRequest.save();

      expect(betaRequest.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test data
      await BetaRequest.create([
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '555-1111',
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          createdAt: new Date('2025-01-01')
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '555-2222',
          address: '456 Oak Ave',
          city: 'Dallas',
          state: 'TX',
          zipCode: '75201',
          createdAt: new Date('2025-01-15')
        },
        {
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob@example.com',
          phone: '555-3333',
          address: '789 Elm St',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
          createdAt: new Date('2025-01-10')
        }
      ]);
    });

    describe('findAllRequests', () => {
      it('should return all beta requests sorted by createdAt descending', async () => {
        const requests = await BetaRequest.findAllRequests();

        expect(requests).toHaveLength(3);
        expect(requests[0].email).toBe('jane@example.com'); // Most recent
        expect(requests[1].email).toBe('bob@example.com');
        expect(requests[2].email).toBe('john@example.com'); // Oldest
      });

      it('should return empty array when no requests exist', async () => {
        await BetaRequest.deleteMany({});
        const requests = await BetaRequest.findAllRequests();

        expect(requests).toHaveLength(0);
      });
    });

    describe('findByEmail', () => {
      it('should find beta request by email', async () => {
        const request = await BetaRequest.findByEmail('john@example.com');

        expect(request).toBeTruthy();
        expect(request.firstName).toBe('John');
        expect(request.lastName).toBe('Doe');
      });

      it('should find beta request by email case-insensitively', async () => {
        const request = await BetaRequest.findByEmail('JOHN@EXAMPLE.COM');

        expect(request).toBeTruthy();
        expect(request.email).toBe('john@example.com');
      });

      it('should return null when email not found', async () => {
        const request = await BetaRequest.findByEmail('nonexistent@example.com');

        expect(request).toBeNull();
      });
    });
  });

  describe('Welcome Email Tracking', () => {
    it('should track welcome email status', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-0000',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        welcomeEmailSent: true,
        welcomeEmailSentAt: new Date(),
        welcomeEmailSentBy: 'admin@wavemax.promo'
      });

      expect(betaRequest.welcomeEmailSent).toBe(true);
      expect(betaRequest.welcomeEmailSentAt).toBeDefined();
      expect(betaRequest.welcomeEmailSentBy).toBe('admin@wavemax.promo');
    });
  });

  describe('Reminder Email Tracking', () => {
    it('should track reminder emails', async () => {
      const betaRequest = await BetaRequest.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '555-0000',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        reminderEmailCount: 2,
        lastReminderEmailSentAt: new Date(),
        reminderEmailHistory: [
          {
            sentAt: new Date('2025-01-01'),
            sentBy: 'admin@wavemax.promo'
          },
          {
            sentAt: new Date('2025-01-15'),
            sentBy: 'admin@wavemax.promo'
          }
        ]
      });

      expect(betaRequest.reminderEmailCount).toBe(2);
      expect(betaRequest.lastReminderEmailSentAt).toBeDefined();
      expect(betaRequest.reminderEmailHistory).toHaveLength(2);
      expect(betaRequest.reminderEmailHistory[0].sentBy).toBe('admin@wavemax.promo');
    });
  });
});
