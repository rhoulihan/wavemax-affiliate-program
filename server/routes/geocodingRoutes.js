const express = require('express');
const router = express.Router();
const axios = require('axios');

// Downtown Austin coordinates
const AUSTIN_CENTER = {
  lat: 30.2672,
  lon: -97.7431
};

// 50 mile radius in degrees (approximate)
// 1 degree latitude ≈ 69 miles, 1 degree longitude ≈ 54 miles at Austin's latitude
const SEARCH_RADIUS_DEGREES = {
  lat: 50 / 69,  // ≈ 0.72 degrees
  lon: 50 / 54   // ≈ 0.93 degrees
};

// Calculate bounding box for Austin area (50 mile radius)
const AUSTIN_BOUNDS = {
  minLat: AUSTIN_CENTER.lat - SEARCH_RADIUS_DEGREES.lat,
  maxLat: AUSTIN_CENTER.lat + SEARCH_RADIUS_DEGREES.lat,
  minLon: AUSTIN_CENTER.lon - SEARCH_RADIUS_DEGREES.lon,
  maxLon: AUSTIN_CENTER.lon + SEARCH_RADIUS_DEGREES.lon
};

// Helper function to parse natural address format
function parseAddress(input) {
  // Expected format: "addressNumber street, city, state zipCode"
  // But we need to be flexible for partial inputs
  
  const trimmed = input.trim();
  
  // Check if we have at least a street number and name (minimum for search)
  const streetPattern = /^\d+\s+\w+/;
  if (!streetPattern.test(trimmed)) {
    return null; // Not enough info to search
  }
  
  // Try to parse the full format
  const parts = trimmed.split(',').map(p => p.trim());
  
  let streetAddress = parts[0];
  let city = '';
  let stateZip = '';
  
  if (parts.length > 1) {
    // Check if second part is city or city + state/zip
    const lastPart = parts[parts.length - 1];
    const stateZipPattern = /\s+(TX|Texas)\s*(\d{5})?$/i;
    const stateZipMatch = lastPart.match(stateZipPattern);
    
    if (stateZipMatch) {
      // Last part contains state/zip
      city = lastPart.replace(stateZipPattern, '').trim();
      stateZip = stateZipMatch[0].trim();
    } else if (parts.length === 2) {
      // Just street and city
      city = lastPart;
    } else if (parts.length === 3) {
      // Street, city, state/zip
      city = parts[1];
      stateZip = parts[2];
    }
  }
  
  // Build search query focusing on Austin area
  let searchQuery = streetAddress;
  if (city) {
    searchQuery += ', ' + city;
  }
  if (stateZip) {
    searchQuery += ', ' + stateZip;
  } else {
    // Default to Texas if no state specified
    searchQuery += ', TX';
  }
  
  // Always append USA for better results
  searchQuery += ', USA';
  
  return searchQuery;
}

// Forward geocoding (address to coordinates)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
      return res.json([]);
    }
    
    // Parse the address
    const searchQuery = parseAddress(q);
    if (!searchQuery) {
      return res.json([]); // Not enough info to search
    }
    
    // Use Nominatim API with viewbox to limit results to Austin area
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'json',
        q: searchQuery,  // Use parsed query instead of raw input
        limit: 5,
        'accept-language': 'en',
        // Limit search to Austin area
        viewbox: `${AUSTIN_BOUNDS.minLon},${AUSTIN_BOUNDS.minLat},${AUSTIN_BOUNDS.maxLon},${AUSTIN_BOUNDS.maxLat}`,
        bounded: 1,  // Strictly limit results to viewbox
        countrycodes: 'us'  // Limit to USA
      },
      headers: {
        'User-Agent': 'WaveMAX-Affiliate-Program/1.0'
      }
    });
    
    // Filter results to ensure they're within bounds
    const filteredResults = response.data.filter(item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      return lat >= AUSTIN_BOUNDS.minLat && lat <= AUSTIN_BOUNDS.maxLat &&
             lon >= AUSTIN_BOUNDS.minLon && lon <= AUSTIN_BOUNDS.maxLon;
    });
    
    // Return simplified results
    const results = filteredResults.map(item => ({
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon
    }));
    
    res.json(results);
  } catch (error) {
    console.error('Geocoding search error:', error);
    res.status(500).json({ error: 'Geocoding service unavailable' });
  }
});

// Reverse geocoding (coordinates to address)
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // Use Nominatim API
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat: lat,
        lon: lon,
        'accept-language': 'en'
      },
      headers: {
        'User-Agent': 'WaveMAX-Affiliate-Program/1.0'
      }
    });
    
    res.json({
      display_name: response.data.display_name || 'Unknown location'
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({ error: 'Geocoding service unavailable' });
  }
});

module.exports = router;