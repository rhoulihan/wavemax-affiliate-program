// System Configuration Routes for WaveMAX Laundry Affiliate Program

const express = require('express');
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/rbac');

// Get all public configurations (no authentication required)
router.get('/public', async (req, res) => {
  try {
    const configs = await SystemConfig.getPublicConfigs();
    res.json(configs);
  } catch (error) {
    console.error('Error fetching public configs:', error);
    res.status(500).json({ error: 'Failed to fetch public configurations' });
  }
});

// Get specific public configuration by key (no authentication required)
router.get('/public/:key', async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ 
      key: req.params.key, 
      isPublic: true 
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Admin routes below this point require authentication
router.use(authenticateToken);
router.use(checkRole(['administrator']));

// Get all configurations (admin only)
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let configs;
    
    if (category) {
      configs = await SystemConfig.getByCategory(category);
    } else {
      configs = await SystemConfig.find().sort('category key');
    }
    
    res.json(configs);
  } catch (error) {
    console.error('Error fetching configs:', error);
    res.status(500).json({ error: 'Failed to fetch configurations' });
  }
});

// Update configuration value (admin only)
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const adminId = req.user.userId;
    
    const config = await SystemConfig.setValue(req.params.key, value, adminId);
    res.json(config);
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(400).json({ error: error.message });
  }
});

// Initialize default configurations (admin only)
router.post('/initialize', async (req, res) => {
  try {
    await SystemConfig.initializeDefaults();
    res.json({ message: 'Default configurations initialized' });
  } catch (error) {
    console.error('Error initializing configs:', error);
    res.status(500).json({ error: 'Failed to initialize configurations' });
  }
});

module.exports = router;