const express = require('express');
const router = express.Router();
const axios = require('axios');

// Forward geocoding (address to coordinates)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
      return res.json([]);
    }
    
    // Use Nominatim API
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'json',
        q: q,
        limit: 5,
        'accept-language': 'en'
      },
      headers: {
        'User-Agent': 'WaveMAX-Affiliate-Program/1.0'
      }
    });
    
    // Return simplified results
    const results = response.data.map(item => ({
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