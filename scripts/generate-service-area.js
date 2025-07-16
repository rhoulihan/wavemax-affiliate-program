#!/usr/bin/env node

/**
 * Script to generate service area data (cities and zip codes within radius of Austin, TX)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Austin, TX coordinates
const AUSTIN_LAT = 30.2672;
const AUSTIN_LON = -97.7431;
const RADIUS_MILES = 50;

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

// Download zip code data
function downloadZipCodeData() {
  return new Promise((resolve, reject) => {
    console.log('Downloading Texas zip code data...');
    
    // Using a simplified dataset - we'll create our own for Texas
    // In production, you might want to use a more comprehensive source
    const texasZipCodes = generateTexasZipCodes();
    resolve(texasZipCodes);
  });
}

// Generate a subset of Texas zip codes with coordinates
// This is a simplified dataset - in production, use a complete dataset
function generateTexasZipCodes() {
  // Major Texas cities and their surrounding zip codes
  // Format: [zip, city, lat, lon]
  const texasData = [
    // Austin and surrounding areas
    ['78701', 'Austin', 30.2711, -97.7437],
    ['78702', 'Austin', 30.2605, -97.7139],
    ['78703', 'Austin', 30.2935, -97.7691],
    ['78704', 'Austin', 30.2425, -97.7703],
    ['78705', 'Austin', 30.2901, -97.7425],
    ['78712', 'Austin', 30.2847, -97.7403],
    ['78717', 'Austin', 30.4881, -97.7661],
    ['78721', 'Austin', 30.2703, -97.6889],
    ['78722', 'Austin', 30.2894, -97.7169],
    ['78723', 'Austin', 30.3069, -97.6825],
    ['78724', 'Austin', 30.2968, -97.6542],
    ['78725', 'Austin', 30.2353, -97.6675],
    ['78726', 'Austin', 30.4352, -97.8331],
    ['78727', 'Austin', 30.4201, -97.7100],
    ['78728', 'Austin', 30.4375, -97.6781],
    ['78729', 'Austin', 30.4478, -97.7692],
    ['78730', 'Austin', 30.3625, -97.8217],
    ['78731', 'Austin', 30.3458, -97.7717],
    ['78732', 'Austin', 30.3792, -97.8967],
    ['78733', 'Austin', 30.3175, -97.8667],
    ['78734', 'Austin', 30.3775, -97.9467],
    ['78735', 'Austin', 30.2542, -97.8367],
    ['78736', 'Austin', 30.2175, -97.9067],
    ['78737', 'Austin', 30.1975, -97.9567],
    ['78738', 'Austin', 30.3175, -97.9867],
    ['78739', 'Austin', 30.1875, -97.8767],
    ['78741', 'Austin', 30.2301, -97.7225],
    ['78742', 'Austin', 30.2301, -97.6969],
    ['78744', 'Austin', 30.1847, -97.7428],
    ['78745', 'Austin', 30.2069, -97.7953],
    ['78746', 'Austin', 30.2658, -97.8081],
    ['78747', 'Austin', 30.1319, -97.7589],
    ['78748', 'Austin', 30.1689, -97.8231],
    ['78749', 'Austin', 30.2169, -97.8431],
    ['78750', 'Austin', 30.4469, -97.8031],
    ['78751', 'Austin', 30.3103, -97.7261],
    ['78752', 'Austin', 30.3336, -97.7092],
    ['78753', 'Austin', 30.3736, -97.6742],
    ['78754', 'Austin', 30.3536, -97.6542],
    ['78756', 'Austin', 30.3169, -97.7425],
    ['78757', 'Austin', 30.3503, -97.7256],
    ['78758', 'Austin', 30.3836, -97.7086],
    ['78759', 'Austin', 30.4203, -97.7417],
    
    // Round Rock
    ['78664', 'Round Rock', 30.5083, -97.6789],
    ['78665', 'Round Rock', 30.5483, -97.6589],
    ['78681', 'Round Rock', 30.5083, -97.7089],
    
    // Pflugerville
    ['78660', 'Pflugerville', 30.4383, -97.6200],
    
    // Cedar Park
    ['78613', 'Cedar Park', 30.5053, -97.8203],
    
    // Georgetown
    ['78626', 'Georgetown', 30.6333, -97.6778],
    ['78627', 'Georgetown', 30.6633, -97.6778],
    ['78628', 'Georgetown', 30.6833, -97.6778],
    
    // Leander
    ['78641', 'Leander', 30.5788, -97.8531],
    
    // Buda
    ['78610', 'Buda', 30.0853, -97.8403],
    
    // Kyle
    ['78640', 'Kyle', 29.9892, -97.8775],
    
    // San Marcos
    ['78666', 'San Marcos', 29.8833, -97.9414],
    ['78667', 'San Marcos', 29.8833, -97.9414],
    
    // Dripping Springs
    ['78619', 'Dripping Springs', 30.1903, -98.0867],
    ['78620', 'Dripping Springs', 30.1903, -98.0867],
    
    // Bee Cave
    ['78738', 'Bee Cave', 30.3175, -97.9867],
    
    // Lakeway
    ['78734', 'Lakeway', 30.3775, -97.9467],
    
    // Manor
    ['78653', 'Manor', 30.3408, -97.5569],
    
    // Elgin
    ['78621', 'Elgin', 30.3494, -97.3700],
    
    // Bastrop
    ['78602', 'Bastrop', 30.1105, -97.3153],
    
    // Lockhart
    ['78644', 'Lockhart', 29.8850, -97.6700],
    
    // Taylor
    ['76574', 'Taylor', 30.5708, -97.4094],
    
    // Hutto
    ['78634', 'Hutto', 30.5428, -97.5467],
    
    // Wimberley
    ['78676', 'Wimberley', 29.9975, -98.0986],
    
    // Lago Vista
    ['78645', 'Lago Vista', 30.4603, -97.9889],
    
    // Spicewood
    ['78669', 'Spicewood', 30.4761, -98.1561],
  ];
  
  return texasData;
}

async function generateServiceAreaData() {
  try {
    const zipCodes = await downloadZipCodeData();
    
    console.log(`Processing ${zipCodes.length} Texas zip codes...`);
    
    const serviceArea = {
      state: 'TX',
      centerCity: 'Austin',
      centerLat: AUSTIN_LAT,
      centerLon: AUSTIN_LON,
      radiusMiles: RADIUS_MILES,
      locations: []
    };
    
    // Track unique cities
    const citiesSet = new Set();
    const cityZipMap = new Map();
    
    // Filter zip codes within radius
    for (const [zip, city, lat, lon] of zipCodes) {
      const distance = calculateDistance(AUSTIN_LAT, AUSTIN_LON, lat, lon);
      
      if (distance <= RADIUS_MILES) {
        serviceArea.locations.push({
          zip: zip,
          city: city,
          lat: lat,
          lon: lon,
          distance: Math.round(distance * 10) / 10
        });
        
        citiesSet.add(city);
        
        if (!cityZipMap.has(city)) {
          cityZipMap.set(city, []);
        }
        cityZipMap.get(city).push(zip);
      }
    }
    
    // Sort locations by city name, then by zip code
    serviceArea.locations.sort((a, b) => {
      if (a.city !== b.city) {
        return a.city.localeCompare(b.city);
      }
      return a.zip.localeCompare(b.zip);
    });
    
    // Create summary
    serviceArea.summary = {
      totalZipCodes: serviceArea.locations.length,
      totalCities: citiesSet.size,
      cities: Array.from(citiesSet).sort(),
      cityZipCounts: Object.fromEntries(
        Array.from(cityZipMap.entries())
          .map(([city, zips]) => [city, zips.length])
          .sort(([a], [b]) => a.localeCompare(b))
      )
    };
    
    // Create lists for autocomplete
    serviceArea.autocomplete = {
      cities: Array.from(citiesSet).sort(),
      zipCodes: serviceArea.locations.map(loc => loc.zip).sort()
    };
    
    // Save to file
    const outputDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const outputPath = path.join(outputDir, 'service-area.json');
    fs.writeFileSync(outputPath, JSON.stringify(serviceArea, null, 2));
    
    // Check file size
    const stats = fs.statSync(outputPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log('\nService area data generated successfully!');
    console.log(`File: ${outputPath}`);
    console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
    console.log(`Total zip codes: ${serviceArea.locations.length}`);
    console.log(`Total cities: ${citiesSet.size}`);
    console.log(`\nCities included: ${serviceArea.summary.cities.join(', ')}`);
    
    if (fileSizeMB > 25) {
      console.log('\nWARNING: File size exceeds 25MB. Consider using database storage.');
    }
    
  } catch (error) {
    console.error('Error generating service area data:', error);
    process.exit(1);
  }
}

// Run the script
generateServiceAreaData();