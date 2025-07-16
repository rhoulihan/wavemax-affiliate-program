# Service Area Validation Documentation

## Overview

The WaveMAX Affiliate Program implements location-based service area restrictions to ensure that affiliates and customers are within the operational delivery radius. This system uses a configurable radius from a central city point (default: 50-mile radius from Austin, TX).

## Key Components

### 1. Address Validation Service (`server/services/addressValidationService.js`)

The unified backend service that handles all address validation:

- **Strict validation**: Requires complete street address with house number
- **ZIP code verification**: Ensures the entered ZIP code matches the geocoded location (with tolerance for nearby ZIP codes)
- **OpenStreetMap Nominatim**: Uses OSM's geocoding service for address verification
- **Two-strategy approach**: 
  1. First attempts with full address including city
  2. Falls back to street address + ZIP code if needed

### 2. Address Validation Component (`public/assets/js/address-validation-component.js`)

Frontend component providing consistent validation UI across all forms:

- **Real-time validation**: Validates address format as users type
- **Visual feedback**: Shows success/error messages with appropriate styling
- **Swirl spinner integration**: Displays loading state during validation
- **Reusable**: Used in affiliate registration, customer registration, and dashboards

### 3. Service Area Routes (`server/routes/serviceAreaRoutes.js`)

API endpoints for service area functionality:

- `GET /api/v1/service-area/config` - Returns service area configuration
- `GET /api/v1/service-area/autocomplete` - Provides city/ZIP code autocomplete
- `POST /api/v1/service-area/validate` - Validates addresses and checks service area
- `GET /api/v1/service-area/cities` - Returns list of cities in service area
- `GET /api/v1/service-area/zip-codes` - Returns list of ZIP codes in service area

## Configuration

### Environment Variables

```bash
SERVICE_STATE=TX              # State for service area
SERVICE_CITY=Austin          # Center city for radius calculation
SERVICE_RADIUS_MILES=50      # Maximum service radius in miles
```

### Service Area Data

The system uses pre-loaded Texas city and ZIP code data to:
- Populate dropdowns and autocomplete fields
- Validate that addresses are within Texas
- Calculate distances from the service center

## Validation Flow

### 1. Address Input
- User enters street address, city, state, and ZIP code
- Frontend validates format (must start with house number)
- State is pre-filled based on SERVICE_STATE configuration

### 2. Address Validation
- Frontend sends address to `/api/v1/service-area/validate`
- Backend validates all required fields are present
- Geocoding attempt with OpenStreetMap Nominatim
- ZIP code verification (must match or be in same area)

### 3. Service Area Check
- Calculate distance from address to service center (Austin)
- Compare distance to SERVICE_RADIUS_MILES
- Return success if within radius, error if outside

### 4. User Feedback
- Success: Address is accepted, registration continues
- Outside service area: Error message with distance information
- Invalid address: Error message requesting valid address

## Error Handling

### Common Scenarios

1. **Invalid Address Format**
   - Message: "Address must start with a house number (e.g., 123 Main Street)"
   - Solution: User must enter complete street address

2. **Address Not Found**
   - Message: "Unable to verify this address. Please check that the street address and zip code are correct."
   - Solution: User should verify address spelling and ZIP code

3. **ZIP Code Mismatch**
   - Tolerance: Allows ZIP codes in same area (first 3 digits match)
   - Example: User enters 78744 but geocoding returns 78747 - allowed if both start with 787

4. **Outside Service Area**
   - Message: "Unfortunately, this address is outside the service area. The service area extends 50 miles from the affiliate location, and this address is X.X miles away."
   - Solution: User must use address within service radius

## Security Considerations

1. **CSRF Protection**: Service area endpoints are public but protected against CSRF attacks
2. **Rate Limiting**: Prevents abuse of geocoding API
3. **Input Sanitization**: All addresses are sanitized before geocoding
4. **No PII Storage**: Validation is stateless, no addresses stored during validation

## Testing

### Manual Testing
1. Test with valid Austin address: "3401 Arrowhead Circle, Round Rock, TX 78681"
2. Test with invalid address: "123 Fake Street, Austin, TX 78701"
3. Test outside radius: "123 Main St, Houston, TX 77001"
4. Test ZIP mismatch: Verify tolerance for nearby ZIP codes

### Automated Testing
- Unit tests for address format validation
- Integration tests for geocoding service
- Distance calculation tests
- Service area boundary tests

## Future Enhancements

1. **Multiple Service Areas**: Support for multiple cities with different radii
2. **Polygon Boundaries**: Use custom shapes instead of radius
3. **Cached Geocoding**: Store validated addresses to reduce API calls
4. **Address Suggestions**: Provide suggestions for misspelled addresses
5. **Business Rules**: Different radius for residential vs commercial addresses

## Troubleshooting

### Common Issues

1. **All addresses failing validation**
   - Check Nominatim API is accessible
   - Verify no rate limiting in effect
   - Check SERVICE_* environment variables are set

2. **Valid addresses rejected**
   - OpenStreetMap data may be incomplete
   - Consider relaxing ZIP code validation
   - Check if address is on ZIP code boundary

3. **Service area seems wrong**
   - Verify SERVICE_CITY coordinates in database
   - Check SERVICE_RADIUS_MILES setting
   - Ensure distance calculation is using correct formula

## API Response Examples

### Successful Validation
```json
{
  "success": true,
  "inServiceArea": true,
  "coordinates": {
    "latitude": 30.5082551,
    "longitude": -97.6788844
  },
  "formattedAddress": "3401 Arrowhead Circle, Round Rock, TX 78681",
  "distance": 15.3
}
```

### Outside Service Area
```json
{
  "success": false,
  "message": "Address is outside the service area",
  "distance": 165.4,
  "maxDistance": 50
}
```

### Invalid Address
```json
{
  "success": false,
  "message": "Unable to verify this address. Please check that the street address and zip code are correct."
}
```