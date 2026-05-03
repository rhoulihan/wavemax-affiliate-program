const axios = require('axios');
const googleReviewsService = require('../../server/services/googleReviewsService');

jest.mock('axios');

const PLACE_ID = 'ChIJtest_austin_place_id';
const API_KEY = 'test-google-places-key';

const mockGoogleResponse = {
  data: {
    rating: 4.8,
    userRatingCount: 187,
    reviews: [
      {
        name: `places/${PLACE_ID}/reviews/r1`,
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
        name: `places/${PLACE_ID}/reviews/r2`,
        relativePublishTimeDescription: '2 months ago',
        rating: 5,
        text: { text: 'Super clean facility.', languageCode: 'en' },
        authorAttribution: {
          displayName: 'Omar L.',
          uri: 'https://www.google.com/maps/contrib/bbb',
          photoUri: 'https://lh3.googleusercontent.com/bbb'
        },
        publishTime: '2026-03-01T08:15:00Z'
      },
      {
        name: `places/${PLACE_ID}/reviews/r3`,
        relativePublishTimeDescription: '1 month ago',
        rating: 3,
        text: { text: 'OK but could be better.', languageCode: 'en' },
        authorAttribution: {
          displayName: 'Jane D.',
          uri: 'https://www.google.com/maps/contrib/ccc',
          photoUri: 'https://lh3.googleusercontent.com/ccc'
        },
        publishTime: '2026-04-02T10:00:00Z'
      }
    ]
  }
};

describe('googleReviewsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    googleReviewsService.__clearCache();
    process.env.GOOGLE_PLACES_API_KEY = API_KEY;
  });

  afterAll(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  describe('fetchPlaceReviews', () => {
    it('calls the Places API (New) Place Details endpoint with the correct headers', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      await googleReviewsService.fetchPlaceReviews(PLACE_ID);

      expect(axios.get).toHaveBeenCalledTimes(1);
      const [url, options] = axios.get.mock.calls[0];
      expect(url).toBe(`https://places.googleapis.com/v1/places/${PLACE_ID}`);
      expect(options.headers['X-Goog-Api-Key']).toBe(API_KEY);
      expect(options.headers['X-Goog-FieldMask']).toContain('reviews');
      expect(options.headers['X-Goog-FieldMask']).toContain('rating');
      expect(options.headers['X-Goog-FieldMask']).toContain('userRatingCount');
    });

    it('returns shaped reviews + place metadata', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      const result = await googleReviewsService.fetchPlaceReviews(PLACE_ID);

      expect(result.totalReviewsAtSource).toBe(187);
      expect(result.averageRatingAtSource).toBe(4.8);
      expect(result.reviews).toHaveLength(3);

      const review = result.reviews[0];
      expect(review.author).toBe('Taneisha T.');
      expect(review.rating).toBe(5);
      expect(review.text).toBe('Alex was absolutely amazing.');
      expect(review.relativeTime).toBe('3 weeks ago');
      expect(review.publishTime).toBe('2026-04-12T14:30:22Z');
      expect(review.photoUrl).toBe('https://lh3.googleusercontent.com/aaa');
      expect(review.googleProfileUrl).toBe('https://www.google.com/maps/contrib/aaa');
    });

    it('throws a config error when API key is missing', async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;

      await expect(googleReviewsService.fetchPlaceReviews(PLACE_ID))
        .rejects.toMatchObject({ code: 'CONFIG_MISSING_API_KEY' });
    });

    it('throws a not-found error when API returns 404', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      await expect(googleReviewsService.fetchPlaceReviews(PLACE_ID))
        .rejects.toMatchObject({ code: 'PLACE_NOT_FOUND' });
    });

    it('throws an upstream error on Google 5xx', async () => {
      axios.get.mockRejectedValue({ response: { status: 503 } });

      await expect(googleReviewsService.fetchPlaceReviews(PLACE_ID))
        .rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    });
  });

  describe('filterByRating', () => {
    it('returns only reviews with rating >= minRating', () => {
      const reviews = [
        { author: 'A', rating: 5 },
        { author: 'B', rating: 4 },
        { author: 'C', rating: 3 },
        { author: 'D', rating: 5 }
      ];

      expect(googleReviewsService.filterByRating(reviews, 5)).toEqual([
        { author: 'A', rating: 5 },
        { author: 'D', rating: 5 }
      ]);

      expect(googleReviewsService.filterByRating(reviews, 4)).toHaveLength(3);
      expect(googleReviewsService.filterByRating(reviews, 1)).toHaveLength(4);
    });

    it('returns empty array when no reviews match', () => {
      const reviews = [{ rating: 3 }, { rating: 4 }];
      expect(googleReviewsService.filterByRating(reviews, 5)).toEqual([]);
    });
  });

  describe('getReviewsForLocation (cache + filter)', () => {
    it('fetches once and serves cached on second call within TTL', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      const a = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });
      const b = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(a.reviews).toEqual(b.reviews);
      expect(a.lastFetchedAt).toBe(b.lastFetchedAt);
    });

    it('applies minRating filter to the returned reviews', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      const result = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 5 });

      expect(result.reviews).toHaveLength(2);
      expect(result.reviews.every(r => r.rating >= 5)).toBe(true);
    });

    it('caps results at limit', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      const result = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1, limit: 2 });

      expect(result.reviews).toHaveLength(2);
    });

    it('refetches after cache TTL expires', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });

      googleReviewsService.__advanceCacheClock(25 * 60 * 60 * 1000); // 25h
      await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });

      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('serves stale cache on Google 5xx (stale-while-revalidate)', async () => {
      axios.get.mockResolvedValueOnce(mockGoogleResponse);

      const fresh = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });

      googleReviewsService.__advanceCacheClock(25 * 60 * 60 * 1000); // 25h, cache stale
      axios.get.mockRejectedValueOnce({ response: { status: 503 } });

      const stale = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 1 });
      expect(stale.reviews).toEqual(fresh.reviews);
      expect(stale.servedFromStaleCache).toBe(true);
    });

    it('returns empty payload (not throws) when API key is missing', async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;

      const result = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 5 });

      expect(result.reviews).toEqual([]);
      expect(result.reason).toBe('config');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('returns empty payload when place is not found', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 5 });

      expect(result.reviews).toEqual([]);
      expect(result.reason).toBe('not_found');
    });

    it('attribution payload includes placeId, source label, and lastFetchedAt', async () => {
      axios.get.mockResolvedValue(mockGoogleResponse);

      const result = await googleReviewsService.getReviewsForLocation(PLACE_ID, { minRating: 5 });

      expect(result.source).toBe('google');
      expect(result.placeId).toBe(PLACE_ID);
      expect(result.lastFetchedAt).toBeDefined();
      expect(new Date(result.lastFetchedAt).toString()).not.toBe('Invalid Date');
    });
  });
});
