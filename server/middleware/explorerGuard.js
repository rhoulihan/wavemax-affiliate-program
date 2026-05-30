// Token-guard for /design-explorer/* — not publicly discoverable.
// Requests to /design-explorer/* are allowed only when ?k= matches EXPLORER_TOKEN;
// all other requests (and all non-explorer paths) pass straight through.
function explorerGuard(req, res, next) {
  if (!req.path.startsWith('/design-explorer')) return next();
  const token = process.env.EXPLORER_TOKEN;
  if (!token || req.query.k !== token) {
    return res.status(404).type('html').send('<!doctype html><title>Not found</title>Not found');
  }
  res.set('X-Robots-Tag', 'noindex, nofollow');
  return next();
}
module.exports = explorerGuard;
