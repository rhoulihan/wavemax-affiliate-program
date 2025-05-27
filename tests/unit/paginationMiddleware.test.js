const paginationMiddleware = require('../../server/utils/paginationMiddleware');

describe('Pagination Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      query: {},
      get: jest.fn().mockReturnValue('Mozilla/5.0')
    };
    res = {};
    next = jest.fn();
  });

  it('should set default pagination values when no query params provided', () => {
    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 1,
      limit: 10,
      skip: 0
    });
    expect(next).toHaveBeenCalled();
  });

  it('should parse page and limit from query params', () => {
    req.query = {
      page: '3',
      limit: '25'
    };

    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 3,
      limit: 25,
      skip: 50 // (3-1) * 25
    });
    expect(next).toHaveBeenCalled();
  });

  it('should enforce minimum values', () => {
    req.query = {
      page: '0',
      limit: '-5'
    };

    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 1,
      limit: 1,
      skip: 0
    });
    expect(next).toHaveBeenCalled();
  });

  it('should enforce maximum limit', () => {
    req.query = {
      page: '1',
      limit: '200'
    };

    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 1,
      limit: 100, // Max limit
      skip: 0
    });
    expect(next).toHaveBeenCalled();
  });

  it('should handle non-numeric values', () => {
    req.query = {
      page: 'abc',
      limit: 'xyz'
    };

    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 1,
      limit: 10,
      skip: 0
    });
    expect(next).toHaveBeenCalled();
  });

  it('should calculate skip correctly for different pages', () => {
    const testCases = [
      { page: 1, limit: 10, expectedSkip: 0 },
      { page: 2, limit: 10, expectedSkip: 10 },
      { page: 5, limit: 20, expectedSkip: 80 },
      { page: 10, limit: 50, expectedSkip: 450 }
    ];

    testCases.forEach(({ page, limit, expectedSkip }) => {
      req.query = { page: String(page), limit: String(limit) };
      paginationMiddleware(req, res, next);

      expect(req.pagination.skip).toBe(expectedSkip);
    });
  });

  it('should handle floating point numbers', () => {
    req.query = {
      page: '2.7',
      limit: '15.3'
    };

    paginationMiddleware(req, res, next);

    expect(req.pagination).toEqual({
      page: 2,
      limit: 15,
      skip: 15
    });
    expect(next).toHaveBeenCalled();
  });

  it('should preserve other query parameters', () => {
    req.query = {
      page: '2',
      limit: '20',
      status: 'active',
      sort: 'createdAt'
    };

    paginationMiddleware(req, res, next);

    expect(req.query.status).toBe('active');
    expect(req.query.sort).toBe('createdAt');
    expect(req.pagination).toEqual({
      page: 2,
      limit: 20,
      skip: 20
    });
  });
});