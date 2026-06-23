// Canonical client-IP resolver + rate-limit bucket key.
//
// Why this exists: the app sits behind Cloudflare → nginx → Node with Express
// `trust proxy = 1`, so `req.ip` resolves to the CLOUDFLARE EDGE IP, not the
// visitor. Keying rate limits on `req.ip` therefore buckets every visitor behind
// a given edge together (shared throttle). The real visitor IP arrives in the
// `cf-connecting-ip` header — these helpers make that the source of truth.

const { clientIp, ipBucketKey } = require('../../server/utils/clientIp');

describe('clientIp', () => {
  it('prefers cf-connecting-ip over req.ip (the CF edge)', () => {
    const req = {
      headers: { 'cf-connecting-ip': '203.0.113.7' },
      ip: '172.69.1.1' // a Cloudflare edge address
    };
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('falls back to req.ip when cf-connecting-ip is absent', () => {
    expect(clientIp({ headers: {}, ip: '198.51.100.4' })).toBe('198.51.100.4');
  });

  it('falls back to socket.remoteAddress when neither header nor req.ip is set', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '198.51.100.9' } })).toBe('198.51.100.9');
  });

  it('strips the IPv4-mapped-IPv6 ::ffff: prefix', () => {
    expect(clientIp({ headers: { 'cf-connecting-ip': '::ffff:203.0.113.7' }, ip: 'x' })).toBe('203.0.113.7');
  });

  it('trims surrounding whitespace', () => {
    expect(clientIp({ headers: { 'cf-connecting-ip': '  203.0.113.7  ' } })).toBe('203.0.113.7');
  });

  it('lets a whitespace-only header fall through to req.ip (not collapse to "")', () => {
    // Regression: a truthy whitespace header must NOT win the fallback and
    // resolve to '' — that would bucket all such traffic into one shared key.
    expect(clientIp({ headers: { 'cf-connecting-ip': '   ' }, ip: '198.51.100.4' })).toBe('198.51.100.4');
  });

  it('returns empty string for a null/undefined request', () => {
    expect(clientIp(null)).toBe('');
    expect(clientIp(undefined)).toBe('');
  });

  it('returns empty string when nothing is resolvable', () => {
    expect(clientIp({ headers: {} })).toBe('');
  });
});

describe('ipBucketKey', () => {
  it('returns an IPv4 address unchanged', () => {
    expect(ipBucketKey({ headers: { 'cf-connecting-ip': '203.0.113.7' } })).toBe('203.0.113.7');
  });

  it('uses the REAL visitor IP, not the CF edge, for the bucket', () => {
    const req = { headers: { 'cf-connecting-ip': '203.0.113.7' }, ip: '172.69.1.1' };
    expect(ipBucketKey(req)).toBe('203.0.113.7');
  });

  it('collapses an IPv6 address to its /64 prefix', () => {
    const key = ipBucketKey({ headers: { 'cf-connecting-ip': '2001:db8:1234:5678:9abc:def0:1111:2222' } });
    expect(key).toBe('2001:db8:1234:5678::/64');
  });

  it('buckets two IPv6 addresses in the same /64 to the same key', () => {
    const a = ipBucketKey({ headers: { 'cf-connecting-ip': '2001:db8:abcd:1:1:1:1:1' } });
    const b = ipBucketKey({ headers: { 'cf-connecting-ip': '2001:db8:abcd:1:ffff:ffff:ffff:ffff' } });
    expect(a).toBe(b);
    expect(a).toBe('2001:db8:abcd:1::/64');
  });

  it('keeps IPv6 addresses in different /64s in different buckets', () => {
    const a = ipBucketKey({ headers: { 'cf-connecting-ip': '2001:db8:abcd:1::1' } });
    const b = ipBucketKey({ headers: { 'cf-connecting-ip': '2001:db8:abcd:2::1' } });
    expect(a).not.toBe(b);
  });

  it('normalizes an IPv4-mapped IPv6 address to plain IPv4', () => {
    expect(ipBucketKey({ headers: { 'cf-connecting-ip': '::ffff:203.0.113.7' } })).toBe('203.0.113.7');
  });

  it('falls back to the raw resolved value for an unparseable IP with no req.ip', () => {
    expect(ipBucketKey({ headers: { 'cf-connecting-ip': 'not-an-ip' } })).toBe('not-an-ip');
  });

  it('falls back to req.ip when cf-connecting-ip is garbage but req.ip is valid', () => {
    // A spoofed/malformed header on a direct-to-origin hit must not mint a fresh
    // per-request bucket; the proxy IP is the safe, stable key.
    expect(ipBucketKey({ headers: { 'cf-connecting-ip': 'garbage;rm -rf' }, ip: '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('a whitespace header buckets by req.ip, not a shared empty key', () => {
    expect(ipBucketKey({ headers: { 'cf-connecting-ip': '   ' }, ip: '198.51.100.4' })).toBe('198.51.100.4');
  });

  it('returns empty string for a null request', () => {
    expect(ipBucketKey(null)).toBe('');
  });
});
