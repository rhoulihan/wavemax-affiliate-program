jest.mock('axios');
const axios = require('axios');
const gbp = require('../../server/services/gbpService');

describe('gbpService', () => {
  const OLD_ENV = process.env.GOOGLE_PLACES_API_KEY;
  beforeAll(() => { process.env.GOOGLE_PLACES_API_KEY = 'test-key'; });
  afterAll(() => { process.env.GOOGLE_PLACES_API_KEY = OLD_ENV; });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('parsePlaceFromUrl', () => {
    it('extracts name and coordinates from a /maps/place/ URL', () => {
      const out = gbp.parsePlaceFromUrl(
        'https://www.google.com/maps/place/WaveMAX+Laundry+Austin/@30.356606,-97.686748,17z/data=...'
      );
      expect(out.name).toBe('WaveMAX Laundry Austin');
      expect(out.lat).toBeCloseTo(30.356606, 4);
      expect(out.lng).toBeCloseTo(-97.686748, 4);
    });

    it('falls back to the ?q= query when there is no /place/ segment', () => {
      const out = gbp.parsePlaceFromUrl('https://maps.google.com/?q=Joe%27s+Laundry+Dallas');
      expect(out.name).toBe("Joe's Laundry Dallas");
    });

    it('returns null name for an unparseable URL', () => {
      expect(gbp.parsePlaceFromUrl('https://example.com/nope').name).toBeNull();
    });
  });

  describe('resolveGbpLink', () => {
    it('resolves a maps URL → placeId + light-localization details', async () => {
      // searchText (POST) then place details (GET)
      axios.post.mockResolvedValueOnce({
        data: { places: [{ id: 'PLACE123', displayName: { text: 'WaveMAX Laundry Austin' }, formattedAddress: '825 E Rundberg Ln, Austin, TX', location: { latitude: 30.35, longitude: -97.68 } }] }
      });
      axios.get.mockResolvedValueOnce({
        data: {
          id: 'PLACE123',
          displayName: { text: 'WaveMAX Laundry Austin' },
          formattedAddress: '825 E Rundberg Ln, Austin, TX 78753',
          internationalPhoneNumber: '+1 512-553-1674',
          regularOpeningHours: { weekdayDescriptions: ['Monday: 7 AM–9 PM'] },
          location: { latitude: 30.356606, longitude: -97.686748 },
          rating: 4.8,
          userRatingCount: 48
        }
      });
      const out = await gbp.resolveGbpLink('https://www.google.com/maps/place/WaveMAX+Laundry+Austin/@30.356606,-97.686748,17z');
      expect(out.placeId).toBe('PLACE123');
      expect(out.name).toBe('WaveMAX Laundry Austin');
      expect(out.formattedAddress).toMatch(/Rundberg/);
      expect(out.phone).toBe('+1 512-553-1674');
      expect(out.rating).toBe(4.8);
      // non-short link: no redirect-following request
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('rejects a non-URL input with INVALID_LINK', async () => {
      await expect(gbp.resolveGbpLink('not a url')).rejects.toMatchObject({ code: 'INVALID_LINK' });
    });

    it('rejects a link with no readable business as RESOLVE_FAILED', async () => {
      await expect(gbp.resolveGbpLink('https://example.com/nothing-here')).rejects.toMatchObject({ code: 'RESOLVE_FAILED' });
    });

    it('rejects when Places finds no match (RESOLVE_FAILED)', async () => {
      axios.post.mockResolvedValueOnce({ data: { places: [] } });
      await expect(
        gbp.resolveGbpLink('https://www.google.com/maps/place/Nonexistent+Biz/@1.0,1.0,17z')
      ).rejects.toMatchObject({ code: 'RESOLVE_FAILED' });
    });
  });

  describe('getPlaceDetails', () => {
    it('throws CONFIG_MISSING_API_KEY when the key is absent', async () => {
      const saved = process.env.GOOGLE_PLACES_API_KEY;
      delete process.env.GOOGLE_PLACES_API_KEY;
      await expect(gbp.getPlaceDetails('X')).rejects.toMatchObject({ code: 'CONFIG_MISSING_API_KEY' });
      process.env.GOOGLE_PLACES_API_KEY = saved;
    });
  });
});
