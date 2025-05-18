const paginationMiddleware = (req, res, next) => {
  // Extract pagination params from query string
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  
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