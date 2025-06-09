const express = require('express');
const router = express.Router();
const axios = require('axios');

// Proxy endpoint for OpenRouteService API to avoid CORS issues
router.post('/directions', async (req, res) => {
  try {
    const { coordinates, preference = 'recommended' } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Must provide an array with at least 2 coordinate pairs.'
      });
    }
    
    // OpenRouteService API configuration
    const apiKey = '5b3ce3597851110001cf6248ba33ed1e2a084f1f91a7753e2f03e3df';
    const url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
    
    const requestBody = {
      coordinates: coordinates,
      continue_straight: false,
      preference: preference
    };
    
    // Make request to OpenRouteService
    const response = await axios.post(url, requestBody, {
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
        'Authorization': apiKey,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    // Return the response data
    res.json({
      success: true,
      data: response.data
    });
    
  } catch (error) {
    console.error('Routing proxy error:', error.message);
    
    // Handle specific error cases
    if (error.response) {
      // OpenRouteService returned an error
      console.error('OpenRouteService error response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      
      res.status(error.response.status).json({
        success: false,
        message: error.response.data.error || 'Routing service error',
        details: error.response.data
      });
    } else if (error.request) {
      // Request was made but no response received
      res.status(503).json({
        success: false,
        message: 'Routing service unavailable'
      });
    } else {
      // Something else went wrong
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
});

module.exports = router;