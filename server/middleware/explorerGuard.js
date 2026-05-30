// Token-guard for /design-explorer/* — not publicly discoverable.
// Requests to /design-explorer/* are allowed only when ?k= matches EXPLORER_TOKEN;
// all other requests (and all non-explorer paths) pass straight through.
//
// NOTE: The prefix check below is case-sensitive and assumes a case-sensitive
// filesystem (Linux/ext4 in production). On a case-insensitive FS (macOS HFS+,
// Windows NTFS) an attacker could reach the files via a differently-cased URL
// without being guarded; an additional lower-casing guard would be required.
function explorerGuard(req, res, next) {
  const inExplorer = req.path === '/design-explorer' || req.path.startsWith('/design-explorer/');
  if (!inExplorer) return next();
  const token = process.env.EXPLORER_TOKEN;
  if (!token || req.query.k !== token) {
    res.set('Cache-Control', 'no-store');
    return res.status(404).type('html').send('<!doctype html><title>Not found</title>Not found');
  }
  res.set('X-Robots-Tag', 'noindex, nofollow');
  return next();
}
module.exports = explorerGuard;
