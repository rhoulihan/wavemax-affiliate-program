// Debug script to understand mock issues
const ControllerHelpers = require('./server/utils/controllerHelpers');

// Simple test
const res = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
};

// Call sendSuccess directly
ControllerHelpers.sendSuccess(res, { test: 'data' }, 'Success', 201);

console.log('res.status called:', res.status.mock.calls);
console.log('res.json called:', res.json.mock.calls);