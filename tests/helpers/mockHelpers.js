/**
 * Helper functions for creating chainable mocks for MongoDB-style queries
 */

/**
 * Creates a chainable mock for MongoDB query methods
 * @param {*} returnValue - The value to eventually return
 * @returns {Object} Chainable mock object
 */
function createChainableMock(returnValue = null) {
  const mock = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(returnValue),
    then: (resolve) => resolve(returnValue),
    catch: jest.fn().mockReturnThis()
  };
  
  // Make each method return the mock object for chaining
  Object.keys(mock).forEach(key => {
    if (key !== 'exec' && key !== 'then' && key !== 'catch') {
      mock[key].mockReturnValue(mock);
    }
  });
  
  return mock;
}

/**
 * Creates a mock for MongoDB Model.find/findOne that supports chaining
 * @param {*} returnValue - The value to eventually return
 * @returns {Function} Mock function that returns chainable mock
 */
function createFindMock(returnValue = null) {
  const chainableMock = createChainableMock(returnValue);
  const findMock = jest.fn().mockReturnValue(chainableMock);
  
  // Also make the mock itself chainable for direct promise resolution
  findMock.mockResolvedValue = jest.fn().mockImplementation((value) => {
    findMock.mockReturnValue(Promise.resolve(value));
    return findMock;
  });
  
  return findMock;
}

/**
 * Creates a mock for MongoDB Model.findOne that supports chaining
 * @param {*} returnValue - The value to eventually return
 * @returns {Function} Mock function that returns chainable mock or direct value
 */
function createFindOneMock(returnValue = null) {
  const chainableMock = createChainableMock(returnValue);
  
  const findOneMock = jest.fn().mockImplementation(() => {
    // If the return value is already set as a promise, return it
    if (returnValue && typeof returnValue.then === 'function') {
      return returnValue;
    }
    // Otherwise return the chainable mock
    return chainableMock;
  });
  
  // Allow direct promise resolution
  findOneMock.mockResolvedValue = jest.fn().mockImplementation((value) => {
    returnValue = Promise.resolve(value);
    chainableMock.exec.mockResolvedValue(value);
    // Update the then method
    chainableMock.then = (resolve) => resolve(value);
    return findOneMock;
  });
  
  return findOneMock;
}

/**
 * Creates a mock for MongoDB aggregate pipeline
 * @param {*} returnValue - The value to eventually return
 * @returns {Function} Mock function that returns chainable mock
 */
function createAggregateMock(returnValue = []) {
  const mock = {
    match: jest.fn().mockReturnThis(),
    group: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    project: jest.fn().mockReturnThis(),
    lookup: jest.fn().mockReturnThis(),
    unwind: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(returnValue)
  };
  
  Object.keys(mock).forEach(key => {
    if (key !== 'exec') {
      mock[key].mockReturnValue(mock);
    }
  });
  
  const aggregateMock = jest.fn().mockReturnValue(mock);
  aggregateMock.mockResolvedValue = jest.fn().mockImplementation((value) => {
    mock.exec.mockResolvedValue(value);
    return aggregateMock;
  });
  
  return aggregateMock;
}

/**
 * Creates a mock Mongoose document with common methods
 * @param {Object} data - The document data
 * @returns {Object} Mock document
 */
function createMockDocument(data = {}) {
  return {
    ...data,
    _id: data._id || 'mock_id',
    save: jest.fn().mockResolvedValue(data),
    toObject: jest.fn().mockReturnValue(data),
    toJSON: jest.fn().mockReturnValue(data),
    populate: jest.fn().mockResolvedValue(data),
    markModified: jest.fn()
  };
}

/**
 * Creates a mock for count operations
 * @param {number} count - The count to return
 * @returns {Function} Mock function
 */
function createCountMock(count = 0) {
  return jest.fn().mockResolvedValue(count);
}

module.exports = {
  createChainableMock,
  createFindMock,
  createFindOneMock,
  createAggregateMock,
  createMockDocument,
  createCountMock
};