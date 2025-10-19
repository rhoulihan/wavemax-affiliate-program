const request = require('supertest');
const app = require('../../server');
const serviceAreaService = require('../../server/services/serviceAreaService');
const addressValidationService = require('../../server/services/addressValidationService');

jest.mock('../../server/services/addressValidationService');

describe('Service Area Routes', () => {
    describe('GET /api/v1/service-area/config', () => {
        it('should return service area configuration', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/config');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.config).toHaveProperty('state');
            expect(response.body.config).toHaveProperty('centerCity');
            expect(response.body.config).toHaveProperty('radiusMiles');
        });
    });

    describe('GET /api/v1/service-area/autocomplete', () => {
        it('should return autocomplete data', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/autocomplete');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('data');
        });
    });

    describe('GET /api/v1/service-area/cities', () => {
        it('should return list of valid cities', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/cities');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('cities');
            expect(Array.isArray(response.body.cities)).toBe(true);
        });
    });

    describe('GET /api/v1/service-area/zip-codes', () => {
        it('should return list of valid zip codes', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/zip-codes');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('zipCodes');
            expect(Array.isArray(response.body.zipCodes)).toBe(true);
        });
    });

    describe('GET /api/v1/service-area/city/:zipCode', () => {
        it('should return city for a valid zip code', async () => {
            // Get a valid zip code from the service
            const validZipCodes = serviceAreaService.getValidZipCodes();
            if (validZipCodes.length === 0) {
                // Skip test if no zip codes available
                return;
            }

            const testZipCode = validZipCodes[0];
            const response = await request(app)
                .get(`/api/v1/service-area/city/${testZipCode}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('city');
        });

        it('should return 404 for invalid zip code', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/city/00000');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /api/v1/service-area/zip-codes/:city', () => {
        it('should return zip codes for a valid city', async () => {
            // Get a valid city from the service
            const validCities = serviceAreaService.getValidCities();
            if (validCities.length === 0) {
                // Skip test if no cities available
                return;
            }

            const testCity = validCities[0];
            const response = await request(app)
                .get(`/api/v1/service-area/zip-codes/${testCity}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('zipCodes');
            expect(Array.isArray(response.body.zipCodes)).toBe(true);
        });

        it('should return 404 for invalid city', async () => {
            const response = await request(app)
                .get('/api/v1/service-area/zip-codes/InvalidCity123');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('POST /api/v1/service-area/validate', () => {
        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();
        });

        it('should validate a valid address successfully', async () => {
            // Mock service area validation to pass
            const mockValidateAddress = jest.spyOn(serviceAreaService, 'validateAddress');
            mockValidateAddress.mockReturnValue({
                isValid: true,
                errors: []
            });

            // Mock geocoding validation
            addressValidationService.validateAddress.mockResolvedValue({
                valid: true,
                latitude: 30.2672,
                longitude: -97.7431,
                formattedAddress: '123 Main St, Austin, TX 78701'
            });

            const response = await request(app)
                .post('/api/v1/service-area/validate')
                .send({
                    address: '123 Main St',
                    city: 'Austin',
                    state: 'TX',
                    zipCode: '78701'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('coordinates');
            expect(response.body.coordinates).toHaveProperty('latitude');
            expect(response.body.coordinates).toHaveProperty('longitude');
            expect(response.body).toHaveProperty('formattedAddress');
        });

        it('should fail validation if service area check fails', async () => {
            const mockValidateAddress = jest.spyOn(serviceAreaService, 'validateAddress');
            mockValidateAddress.mockReturnValue({
                isValid: false,
                errors: ['Invalid state']
            });

            const response = await request(app)
                .post('/api/v1/service-area/validate')
                .send({
                    address: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    zipCode: '10001'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid state');
        });

        it('should fail validation if geocoding fails', async () => {
            const mockValidateAddress = jest.spyOn(serviceAreaService, 'validateAddress');
            mockValidateAddress.mockReturnValue({
                isValid: true,
                errors: []
            });

            addressValidationService.validateAddress.mockResolvedValue({
                valid: false,
                message: 'Address not found'
            });

            const response = await request(app)
                .post('/api/v1/service-area/validate')
                .send({
                    address: '123 Invalid St',
                    city: 'Austin',
                    state: 'TX',
                    zipCode: '78701'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Address not found');
        });

        it('should handle errors gracefully', async () => {
            const mockValidateAddress = jest.spyOn(serviceAreaService, 'validateAddress');
            mockValidateAddress.mockImplementation(() => {
                throw new Error('Service error');
            });

            const response = await request(app)
                .post('/api/v1/service-area/validate')
                .send({
                    address: '123 Main St',
                    city: 'Austin',
                    state: 'TX',
                    zipCode: '78701'
                });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Failed to validate address');
        });
    });
});
