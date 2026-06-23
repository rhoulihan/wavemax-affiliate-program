// Unit tests for the Google Address Validation geocoding service.
// All HTTP is mocked — no live Google calls. The service must NEVER throw
// (callers fail-open), and must read the API key at call time.
const geocodingService = require('../../server/services/geocodingService');

const OLD_ENV = process.env.GOOGLE_GEOCODING_API_KEY;
const validAV = () => ({
  ok: true,
  status: 200,
  json: async () => ({
    result: {
      verdict: { addressComplete: true, validationGranularity: 'PREMISE', hasUnconfirmedComponents: false },
      address: { formattedAddress: '123 Main St, Austin, TX 78701, USA' },
      geocode: { location: { latitude: 30.2672, longitude: -97.7431 }, placeId: 'PID-123' }
    }
  })
});

beforeEach(() => {
  process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';
  global.fetch = jest.fn().mockResolvedValue(validAV());
});
afterAll(() => {
  if (OLD_ENV === undefined) delete process.env.GOOGLE_GEOCODING_API_KEY;
  else process.env.GOOGLE_GEOCODING_API_KEY = OLD_ENV;
});

describe('geocodingService.geocodeAddress', () => {
  const addr = { address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' };

  it('parses a valid Address Validation response into coords + placeId', async () => {
    const r = await geocodingService.geocodeAddress(addr);
    expect(r.ok).toBe(true);
    expect(r.lat).toBeCloseTo(30.2672, 4);
    expect(r.lng).toBeCloseTo(-97.7431, 4);
    expect(r.placeId).toBe('PID-123');
    expect(r.formatted).toContain('Austin');
    expect(r.granularity).toBe('PREMISE');
  });

  it('calls the validateAddress endpoint with the key and US address lines', async () => {
    await geocodingService.geocodeAddress(addr);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('addressvalidation.googleapis.com/v1:validateAddress');
    expect(url).toContain('key=test-key');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.address.regionCode).toBe('US');
    expect(body.address.addressLines.join(' ')).toContain('123 Main St');
    expect(body.address.addressLines.join(' ')).toContain('78701');
  });

  it('returns ok:false (not_configured) when the API key is absent — never throws', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    const r = await geocodingService.geocodeAddress(addr);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns ok:false on a non-200 response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'bad' } }) });
    const r = await geocodingService.geocodeAddress(addr);
    expect(r.ok).toBe(false);
  });

  it('returns ok:false (never throws) on a network error', async () => {
    global.fetch.mockRejectedValue(new Error('ECONNRESET'));
    const r = await geocodingService.geocodeAddress(addr);
    expect(r.ok).toBe(false);
  });

  it('returns ok:false when the response has no geocode location', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: { verdict: {} } }) });
    const r = await geocodingService.geocodeAddress(addr);
    expect(r.ok).toBe(false);
  });

  it('returns ok:false on missing address fields without calling fetch', async () => {
    const r = await geocodingService.geocodeAddress({ address: '', city: '', state: '', zipCode: '' });
    expect(r.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('geocodingService.distanceMiles (Haversine)', () => {
  it('is ~0 for the same point', () => {
    expect(geocodingService.distanceMiles(30.27, -97.74, 30.27, -97.74)).toBeCloseTo(0, 5);
  });
  it('is ~69 miles for one degree of latitude', () => {
    expect(geocodingService.distanceMiles(0, 0, 1, 0)).toBeCloseTo(69, 0);
  });
  it('computes a known short distance (Austin ↔ Round Rock ≈ 17 mi)', () => {
    const d = geocodingService.distanceMiles(30.2672, -97.7431, 30.5083, -97.6789);
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(20);
  });
});

describe('geocodingService.isConfigured', () => {
  it('true when key present, false when absent', () => {
    expect(geocodingService.isConfigured()).toBe(true);
    delete process.env.GOOGLE_GEOCODING_API_KEY;
    expect(geocodingService.isConfigured()).toBe(false);
  });
});
