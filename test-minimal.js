// Minimal test to debug the controller issue

// Set up all required mocks first
jest.mock('../../server/models/Customer');
jest.mock('../../server/models/Affiliate');
jest.mock('../../server/models/Order');
jest.mock('../../server/models/SystemConfig');
jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));
jest.mock('../../server/utils/encryption', () => ({
  generateUniqueCustomerId: jest.fn().mockResolvedValue('CUST123'),
  hashPassword: jest.fn().mockReturnValue({ hash: 'hash', salt: 'salt' }),
  encryptData: jest.fn(),
  decryptData: jest.fn(),
  verifyPassword: jest.fn()
}));
jest.mock('../../server/utils/emailService');
jest.mock('../../server/utils/fieldFilter');
jest.mock('jsonwebtoken');
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('123456')
}));

// Mock ControllerHelpers 
jest.mock('../../server/utils/controllerHelpers', () => {
  const actualHelpers = {
    asyncWrapper: (fn) => fn,
    sendSuccess: jest.fn().mockImplementation((res, data, message, statusCode = 200) => {
      console.log('sendSuccess called with:', { data, message, statusCode });
      res.status(statusCode).json({ success: true, message, ...data });
    }),
    sendError: jest.fn().mockImplementation((res, message, statusCode = 400, errors = null) => {
      console.log('sendError called with:', { message, statusCode });
      res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
    })
  };
  return actualHelpers;
});

jest.mock('../../server/middleware/authorizationHelpers', () => ({
  checkCustomerAccess: (req, res, next) => next()
}));

const Customer = require('../../server/models/Customer');
const Affiliate = require('../../server/models/Affiliate');
const SystemConfig = require('../../server/models/SystemConfig');
const jwt = require('jsonwebtoken');

// Now require controller after mocks
const customerController = require('../../server/controllers/customerController');

async function testRegister() {
  const req = {
    body: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      username: 'janesmith',
      password: 'password',
      affiliateId: 'AFF123'
    }
  };
  
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  
  const next = jest.fn();
  
  // Set up mock responses
  Affiliate.findOne = jest.fn().mockResolvedValue({ affiliateId: 'AFF123', businessName: 'Test' });
  Customer.findOne = jest.fn().mockResolvedValue(null);
  
  const mockCustomer = { 
    save: jest.fn().mockResolvedValue(true),
    customerId: 'CUST123'
  };
  Customer.mockImplementation(() => mockCustomer);
  
  SystemConfig.getValue = jest.fn().mockResolvedValue(10);
  jwt.sign = jest.fn().mockReturnValue('token');
  
  console.log('Calling registerCustomer...');
  await customerController.registerCustomer(req, res, next);
  
  console.log('res.status calls:', res.status.mock.calls);
  console.log('res.json calls:', res.json.mock.calls);
  console.log('next calls:', next.mock.calls);
}

testRegister().catch(console.error);