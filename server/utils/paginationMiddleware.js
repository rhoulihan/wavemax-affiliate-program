const paginationMiddleware = (req, res, next) => {
  // Extract pagination params from query string
  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 10;

  // Enforce minimum values
  page = Math.max(1, page);
  limit = Math.max(1, limit);

  // Enforce maximum limit
  limit = Math.min(100, limit);

  // Calculate skip value for pagination
  const skip = (page - 1) * limit;

  // Add pagination values to request object
  req.pagination = {
    page,
    limit,
    skip
  };

  next();
};

module.exports = paginationMiddleware;