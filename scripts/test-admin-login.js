#!/usr/bin/env node

// Test administrator login

require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://wavemax.promo';
const EMAIL = 'admin@wavemax.promo';
const PASSWORD = 'R8der50!2025';

async function testLogin() {
  try {
    console.log('Testing administrator login...');
    console.log(`URL: ${BASE_URL}/api/v1/auth/administrator/login`);
    console.log(`Email: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log('');

    // First get CSRF token
    const csrfResponse = await axios.get(`${BASE_URL}/api/csrf-token`, {
      withCredentials: true
    });
    
    const csrfToken = csrfResponse.data.csrfToken;
    console.log(`CSRF Token obtained: ${csrfToken.substring(0, 10)}...`);

    // Attempt login
    const loginResponse = await axios.post(
      `${BASE_URL}/api/v1/auth/administrator/login`,
      {
        email: EMAIL,
        password: PASSWORD
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );

    console.log('\n✅ Login successful!');
    console.log('Response:', JSON.stringify(loginResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ Login failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();