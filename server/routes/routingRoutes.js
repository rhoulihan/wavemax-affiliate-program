const express = require('express');
const router = express.Router();
const path = require('path');

// Serve filmwalk application
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/filmwalk/index.html'));
});

module.exports = router;