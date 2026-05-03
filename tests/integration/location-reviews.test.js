jest.setTimeout(60000);

jest.mock('axios');
const axios = require('axios');

const request = require('supertest');
const googleReviewsService = require('../../server/services/googleReviewsService');

const PLACE_ID = 'ChIJtest_austin_place_id';

const mockGoogleResponse = {
  data: {
    rating: 4.8,
    userRatingCount: 187,
    reviews: [
      {
        relativePublishTimeDescription: '3 weeks ago',
        rating: 5,
        text: { text: 'Alex was absolutely amazing.', languageCode: 'en' },
        authorAttribution: {
          displayName: 'Taneisha T.',
          uri: 'https://www.google.com/maps/contrib/aaa',
          photoUri: 'https://lh3.googleusercontent.com/aaa'
        },
        publishTime: '2026-04-12T14:30:22Z'
      },
      {
        relativePublishTimeDescription: '1 month ago',
        rating: 3,
        text: { text: 'Just OK.', languageCode: 'en' },
        authorAttribution: {
          displayName: 'Jane D.',
          uri: 'https://www.google.com/maps/contrib/ccc',
          photoUri: 'https://lh3.googleusercontent.com/ccc'
        },
        publishTime: '2026-04-02T10:00:00Z'
      },
      {
        relativePublishTimeDescription: '2 months ago',
        rating: 5,
        text: { text: 'Super clean.', languageCode: 'en' },
        authorAttribution: {
          displayName: 'Omar L.',
          uri: 'https://www.google.com/maps/contrib/bbb',
          photoUri: 'https://lh3.googleusercontent.com/bbb'
        },
        publishTime: '2026-03-01T08:15:00Z'
      }
    ]
  }
};

describe('GET /api/v1/location/:slug/reviews', () => {
  let app;

  beforeAll(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    process.env.LOCATION_AUSTIN_TX_PLACE_ID = PLACE_ID;
    app = require('../../server');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    googleReviewsService.__clearCache();
  });

  it('returns 5★-filtered reviews for a known slug', async () => {
    axios.get.mockResolvedValue(mockGoogleResponse);

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews?minRating=5&limit=5')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.source).toBe('google');
    expect(res.body.data.placeId).toBe(PLACE_ID);
    expect(res.body.data.reviews).toHaveLength(2);
    expect(res.body.data.reviews.every(r => r.rating >= 5)).toBe(true);
    expect(res.body.data.totalReviewsAtSource).toBe(187);
    expect(res.body.data.attributionHref).toContain(PLACE_ID);
  });

  it('returns all reviews when minRating not specified', async () => {
    axios.get.mockResolvedValue(mockGoogleResponse);

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews')
      .expect(200);

    expect(res.body.data.reviews).toHaveLength(3);
  });

  it('caps results at limit', async () => {
    axios.get.mockResolvedValue(mockGoogleResponse);

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews?limit=1')
      .expect(200);

    expect(res.body.data.reviews).toHaveLength(1);
  });

  it('clamps limit at 5 (Google API ceiling)', async () => {
    axios.get.mockResolvedValue(mockGoogleResponse);

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews?limit=99')
      .expect(200);

    expect(res.body.data.reviews.length).toBeLessThanOrEqual(5);
  });

  it('rejects minRating outside 1-5', async () => {
    await request(app)
      .get('/api/v1/location/austin-tx/reviews?minRating=99')
      .expect(400);
  });

  it('serves cached on second call within TTL', async () => {
    axios.get.mockResolvedValue(mockGoogleResponse);

    await request(app).get('/api/v1/location/austin-tx/reviews').expect(200);
    await request(app).get('/api/v1/location/austin-tx/reviews').expect(200);

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for unknown slug', async () => {
    await request(app)
      .get('/api/v1/location/nonexistent-tx/reviews')
      .expect(404);
  });

  it('returns soft-empty payload when API key is missing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.reviews).toEqual([]);
    expect(res.body.data.reason).toBe('config');

    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  });

  it('returns soft-empty payload when place not found upstream', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });

    const res = await request(app)
      .get('/api/v1/location/austin-tx/reviews')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.reviews).toEqual([]);
    expect(res.body.data.reason).toBe('not_found');
  });
});
