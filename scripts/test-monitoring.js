#!/usr/bin/env node

// Test script for connectivity monitoring
require('dotenv').config();

const axios = require('axios');

async function testMonitoring() {
  console.log('Testing connectivity monitoring system...\n');

  try {
    // Test the monitoring endpoint
    const response = await axios.get('http://localhost:3000/monitoring/status');
    const data = response.data;

    console.log('Overall System Health:', data.overallHealth);
    console.log('System Uptime:', formatUptime(data.uptime));
    console.log('\nService Status:');
    console.log('═'.repeat(80));

    Object.entries(data.services).forEach(([name, service]) => {
      const statusIcon = service.status === 'up' ? '✅' : '❌';
      const criticalLabel = service.critical ? ' [CRITICAL]' : '';
      
      console.log(`\n${statusIcon} ${name}${criticalLabel}`);
      console.log(`   Status: ${service.status}`);
      console.log(`   Availability: ${service.availability}`);
      console.log(`   Response Time: ${service.responseTime}ms`);
      console.log(`   Last Check: ${service.lastCheck ? new Date(service.lastCheck).toLocaleString() : 'Never'}`);
      
      if (service.lastError) {
        console.log(`   ⚠️  Last Error: ${service.lastError}`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    
    if (data.criticalServicesDown.length > 0) {
      console.log('\n🚨 CRITICAL SERVICES DOWN:', data.criticalServicesDown.join(', '));
    }

    // Test the dashboard URL
    console.log('\n📊 Monitoring Dashboard: https://wavemax.promo/monitoring-dashboard.html');
    
  } catch (error) {
    console.error('❌ Failed to access monitoring endpoint:', error.message);
    console.error('Make sure the server is running with monitoring enabled.');
  }
}

function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}

// Run the test
testMonitoring();